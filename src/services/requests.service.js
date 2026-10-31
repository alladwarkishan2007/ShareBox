import { store } from './store.js';
import { REQUEST_STATUS } from '../config/constants.js';
import { notificationsService } from './notifications.service.js';

class RequestsService {
  async createRequest(payload, user, photoFile = null) {
    let photoURL = null;
    const id = 'req_' + Math.random().toString(36).substring(2, 9);

    if (photoFile) {
      photoURL = await store.uploadFile(photoFile, `requests/${id}/${photoFile.name}`);
    }

    const data = {
      id,
      eventId: payload.eventId || 'campus-general',
      requesterId: user.uid,
      requesterName: user.name || user.email.split('@')[0],
      helperId: null,
      helperName: null,
      type: payload.type || 'request', // 'request' or 'offer'
      itemName: payload.itemName.trim(),
      category: payload.category,
      description: payload.description.trim(),
      quantity: Number(payload.quantity) || 1,
      urgency: payload.urgency,
      neededBy: payload.neededBy,
      expectedReturnAt: payload.expectedReturnAt || null,
      photoURL,
      status: REQUEST_STATUS.OPEN,
      meetingPoint: null,
      handoverCondition: null,
      returnCondition: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.setDoc('requests', id, data);
    return id;
  }

  async acceptRequest(requestId, helperUser) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.status !== REQUEST_STATUS.OPEN) {
      throw new Error('This request has already been accepted by someone else or is no longer open.');
    }

    if (req.requesterId === helperUser.uid) {
      throw new Error('You cannot accept your own request.');
    }

    // Auto-expiry check: delete expired request immediately
    if (new Date(req.neededBy) < new Date()) {
      await store.deleteDoc('requests', requestId);
      throw new Error('This request has expired as the needed-by time has passed and has been automatically deleted.');
    }

    await store.updateDoc('requests', requestId, {
      helperId: helperUser.uid,
      helperName: helperUser.name || helperUser.email.split('@')[0],
      status: REQUEST_STATUS.ACCEPTED
    });

    // Notify requester
    await notificationsService.notifyUser(req.requesterId, {
      type: 'request_accepted',
      refId: requestId,
      title: 'Item Request Accepted',
      message: `${helperUser.name || 'A student'} accepted your request for "${req.itemName}". Real-time chat is now open.`
    });

    return true;
  }

  async cancelRequest(requestId, userId) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.requesterId !== userId) {
      throw new Error('Only the requester can cancel this request.');
    }

    if (![REQUEST_STATUS.OPEN, REQUEST_STATUS.ACCEPTED].includes(req.status)) {
      throw new Error('Cannot cancel a request that has already undergone handover.');
    }

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.CANCELLED
    });

    if (req.helperId) {
      await notificationsService.notifyUser(req.helperId, {
        type: 'request_cancelled',
        refId: requestId,
        title: 'Request Cancelled',
        message: `${req.requesterName} cancelled the request for "${req.itemName}".`
      });
    }

    return true;
  }

  async proposeMeetingPoint(requestId, meetingPointData, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    const point = {
      lat: meetingPointData.lat,
      lng: meetingPointData.lng,
      label: meetingPointData.label,
      proposedBy: user.uid,
      proposedByName: user.name || user.email,
      confirmed: false,
      confirmedBy: null,
      time: meetingPointData.time || null,
      updatedAt: new Date().toISOString()
    };

    await store.updateDoc('requests', requestId, {
      meetingPoint: point
    });

    const otherPartyId = req.requesterId === user.uid ? req.helperId : req.requesterId;
    if (otherPartyId) {
      await notificationsService.notifyUser(otherPartyId, {
        type: 'meeting_point_proposed',
        refId: requestId,
        title: 'Meeting Point Proposed',
        message: `${user.name || 'Peer'} suggested meeting at "${point.label}". Please review and confirm.`
      });
    }

    return point;
  }

  async confirmMeetingPoint(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req || !req.meetingPoint) throw new Error('No meeting point proposed yet.');

    const updatedPoint = {
      ...req.meetingPoint,
      confirmed: true,
      confirmedBy: user.uid,
      confirmedByName: user.name || user.email,
      confirmedAt: new Date().toISOString()
    };

    await store.updateDoc('requests', requestId, {
      meetingPoint: updatedPoint
    });

    const otherPartyId = req.meetingPoint.proposedBy;
    if (otherPartyId && otherPartyId !== user.uid) {
      await notificationsService.notifyUser(otherPartyId, {
        type: 'meeting_point_confirmed',
        refId: requestId,
        title: 'Meeting Point Confirmed',
        message: `${user.name || 'Peer'} confirmed the meeting point at "${updatedPoint.label}".`
      });
    }

    return updatedPoint;
  }

  async confirmHandover(requestId, user, photoFile = null, notes = '') {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.status !== REQUEST_STATUS.ACCEPTED && req.status !== REQUEST_STATUS.HANDED_OVER) {
      throw new Error('Handover can only be marked on accepted requests.');
    }

    let photoURL = req.handoverCondition?.photoURL || null;
    if (photoFile) {
      photoURL = await store.uploadFile(photoFile, `handovers/${requestId}/${photoFile.name}`);
    }

    const currentConfirmed = req.handoverCondition?.confirmedBy || [];
    const newConfirmed = Array.from(new Set([...currentConfirmed, user.uid]));

    const condition = {
      handedOverAt: req.handoverCondition?.handedOverAt || new Date().toISOString(),
      photoURL,
      notes: notes.trim() || req.handoverCondition?.notes || '',
      confirmedBy: newConfirmed
    };

    // Transition to handed_over
    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.HANDED_OVER,
      handoverCondition: condition
    });

    const otherPartyId = req.requesterId === user.uid ? req.helperId : req.requesterId;
    if (otherPartyId) {
      await notificationsService.notifyUser(otherPartyId, {
        type: 'handover_confirmed',
        refId: requestId,
        title: 'Item Handover Recorded',
        message: `${user.name || 'Peer'} confirmed physical handover of "${req.itemName}". Return deadline is now tracking.`
      });
    }

    return condition;
  }

  async markReturned(requestId, user, notes = '') {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.status !== REQUEST_STATUS.HANDED_OVER) {
      throw new Error('Only handed-over items can be marked returned.');
    }

    const returnCond = {
      returnedAt: new Date().toISOString(),
      borrowerNotes: notes.trim(),
      borrowerId: user.uid
    };

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.RETURNED,
      returnCondition: returnCond
    });

    const lenderId = req.type === 'request' ? req.helperId : req.requesterId;
    if (lenderId) {
      await notificationsService.notifyUser(lenderId, {
        type: 'item_returned',
        refId: requestId,
        title: 'Item Marked as Returned',
        message: `${user.name || 'Borrower'} has returned "${req.itemName}". Please inspect and confirm receipt in good condition or report damage.`
      });
    }

    return true;
  }

  async confirmReceivedInGoodCondition(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (![REQUEST_STATUS.RETURNED, REQUEST_STATUS.HANDED_OVER].includes(req.status)) {
      throw new Error('Cannot complete request from this state.');
    }

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.COMPLETED,
      completedAt: new Date().toISOString()
    });

    const borrowerId = req.type === 'request' ? req.requesterId : req.helperId;
    if (borrowerId) {
      await notificationsService.notifyUser(borrowerId, {
        type: 'item_completed',
        refId: requestId,
        title: 'Equipment Return Verified',
        message: `${user.name || 'Owner'} verified that "${req.itemName}" was received in good condition. Transaction successfully completed!`
      });
    }

    return true;
  }

  async getRequestById(requestId) {
    const req = await store.getDoc('requests', requestId);
    if (req && req.status === REQUEST_STATUS.OPEN && new Date(req.neededBy) < new Date()) {
      await store.deleteDoc('requests', requestId);
      return null;
    }
    return req;
  }

  // Purge any open requests whose neededBy deadline has elapsed
  async purgeExpiredRequests() {
    try {
      const allRequests = await store.getDocs('requests');
      const now = new Date();
      for (const req of allRequests) {
        if (req.status === REQUEST_STATUS.OPEN && req.neededBy && new Date(req.neededBy) < now) {
          await store.deleteDoc('requests', req.id);
        }
      }
    } catch (e) {
      console.warn('Error purging expired requests:', e);
    }
  }

  subscribeFeed(eventId, filters, callback) {
    // Run an automatic purge check
    this.purgeExpiredRequests();

    return store.subscribe('requests', (req) => {
      // Automatically filter out and delete any expired open requests
      if (req.status === REQUEST_STATUS.OPEN && req.neededBy && new Date(req.neededBy) < new Date()) {
        store.deleteDoc('requests', req.id);
        return false;
      }

      if (eventId && eventId !== 'all' && req.eventId !== eventId) return false;
      if (filters?.status && req.status !== filters.status) return false;
      if (filters?.category && req.category !== filters.category) return false;
      if (filters?.urgency && req.urgency !== filters.urgency) return false;

      if (filters?.search) {
        const query = filters.search.toLowerCase();
        const matchesName = (req.itemName || '').toLowerCase().includes(query);
        const matchesDesc = (req.description || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    }, (items) => {
      const sorted = [...items].sort((a, b) => {
        if (filters?.sort === 'urgency') {
          const urgencyWeights = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
          return (urgencyWeights[b.urgency] || 0) - (urgencyWeights[a.urgency] || 0);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      callback(sorted);
    });
  }

  subscribeRequest(requestId, callback) {
    return store.subscribe('requests', (req) => req.id === requestId, (items) => {
      const item = items[0] || null;
      if (item && item.status === REQUEST_STATUS.OPEN && new Date(item.neededBy) < new Date()) {
        store.deleteDoc('requests', item.id);
        callback(null);
      } else {
        callback(item);
      }
    });
  }
}

export const requestsService = new RequestsService();
