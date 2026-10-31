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
      handoverAuth: null,
      returnAuth: null,
      completionAuth: null,
      handoverDeadline: null,
      acceptedAt: null,
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

    // Generate secure 4-digit verification PINs for two-sided handshake
    const handoverCode = Math.floor(1000 + Math.random() * 9000).toString();
    const returnCode = Math.floor(1000 + Math.random() * 9000).toString();

    // 30 minute coordination / handover window
    const defaultWindowMs = 30 * 60 * 1000;
    const handoverDeadline = new Date(Date.now() + defaultWindowMs).toISOString();

    await store.updateDoc('requests', requestId, {
      helperId: helperUser.uid,
      helperName: helperUser.name || helperUser.email.split('@')[0],
      status: REQUEST_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString(),
      handoverDeadline,
      handoverAuth: {
        code: handoverCode,
        requesterConfirmed: false,
        helperConfirmed: false,
        confirmedAt: null
      },
      returnAuth: {
        code: returnCode,
        requesterConfirmed: false,
        helperConfirmed: false,
        confirmedAt: null
      },
      completionAuth: {
        requesterConfirmed: false,
        helperConfirmed: false,
        confirmedAt: null
      },
      updatedAt: new Date().toISOString()
    });

    // Notify requester
    await notificationsService.notifyUser(req.requesterId, {
      type: 'request_accepted',
      refId: requestId,
      title: 'Item Request Accepted',
      message: `${helperUser.name || 'A student'} accepted your request for "${req.itemName}". Real-time chat & handover coordination are now open.`
    });

    return true;
  }

  // Helper chooses to stop helping / withdraw help before handover
  async withdrawHelp(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.helperId !== user.uid) {
      throw new Error('Only the assigned helper can withdraw their help.');
    }

    if (req.status !== REQUEST_STATUS.ACCEPTED) {
      throw new Error('Cannot stop helping after physical handover has already taken place.');
    }

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.OPEN,
      helperId: null,
      helperName: null,
      acceptedAt: null,
      handoverDeadline: null,
      handoverAuth: null,
      returnAuth: null,
      completionAuth: null,
      meetingPoint: null,
      updatedAt: new Date().toISOString()
    });

    await notificationsService.notifyUser(req.requesterId, {
      type: 'request_help_withdrawn',
      refId: requestId,
      title: 'Request Reopened (Helper Stepped Down)',
      message: `${user.name || 'The helper'} had to step down and can no longer fulfill your request for "${req.itemName}". Your request has been automatically reopened for the campus community.`
    });

    return true;
  }

  // Requester releases an unresponsive helper after accepted stage
  async reopenUnresponsiveRequest(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.requesterId !== user.uid) {
      throw new Error('Only the requester can reopen an unresponsive request.');
    }

    if (req.status !== REQUEST_STATUS.ACCEPTED) {
      throw new Error('Cannot reopen request after physical handover.');
    }

    const prevHelperId = req.helperId;

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.OPEN,
      helperId: null,
      helperName: null,
      acceptedAt: null,
      handoverDeadline: null,
      handoverAuth: null,
      returnAuth: null,
      completionAuth: null,
      meetingPoint: null,
      updatedAt: new Date().toISOString()
    });

    if (prevHelperId) {
      await notificationsService.notifyUser(prevHelperId, {
        type: 'request_reopened_inactivity',
        refId: requestId,
        title: 'Request Reopened (Inactivity)',
        message: `Your reservation for "${req.itemName}" was released because handover was not completed within the coordination window.`
      });
    }

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
      status: REQUEST_STATUS.CANCELLED,
      updatedAt: new Date().toISOString()
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
      meetingPoint: point,
      updatedAt: new Date().toISOString()
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
      meetingPoint: updatedPoint,
      updatedAt: new Date().toISOString()
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

  // Two-Sided Authentication at Handover Stage (PIN entry or mutual confirmation)
  async authenticateHandover(requestId, user, { pin, photoFile, notes } = {}) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.status !== REQUEST_STATUS.ACCEPTED && req.status !== REQUEST_STATUS.HANDED_OVER) {
      throw new Error('Handover can only be marked on accepted requests.');
    }

    const isRequester = req.requesterId === user.uid;
    const isHelper = req.helperId === user.uid;
    if (!isRequester && !isHelper) {
      throw new Error('Unauthorized: only participants can authenticate handover.');
    }

    let photoURL = req.handoverCondition?.photoURL || null;
    if (photoFile) {
      photoURL = await store.uploadFile(photoFile, `handovers/${requestId}/${photoFile.name}`);
    }

    const auth = req.handoverAuth || {
      code: Math.floor(1000 + Math.random() * 9000).toString(),
      requesterConfirmed: false,
      helperConfirmed: false,
      confirmedAt: null
    };

    let pinMatches = false;
    if (pin && String(pin).trim() === String(auth.code).trim()) {
      pinMatches = true;
    } else if (pin) {
      throw new Error('Invalid Handover PIN. Please check the 4-digit PIN provided by the borrower.');
    }

    if (isRequester) {
      auth.requesterConfirmed = true;
    }
    if (isHelper) {
      auth.helperConfirmed = true;
    }
    if (pinMatches) {
      // Entering borrower's PIN proves in-person physical exchange
      auth.requesterConfirmed = true;
      auth.helperConfirmed = true;
    }

    const bothConfirmed = Boolean(auth.requesterConfirmed && auth.helperConfirmed);

    const condition = {
      handedOverAt: req.handoverCondition?.handedOverAt || new Date().toISOString(),
      photoURL,
      notes: (notes || '').trim() || req.handoverCondition?.notes || '',
      confirmedBy: Array.from(new Set([...(req.handoverCondition?.confirmedBy || []), user.uid]))
    };

    const updatePayload = {
      handoverAuth: auth,
      handoverCondition: condition,
      updatedAt: new Date().toISOString()
    };

    if (bothConfirmed) {
      updatePayload.status = REQUEST_STATUS.HANDED_OVER;
      auth.confirmedAt = new Date().toISOString();
    }

    await store.updateDoc('requests', requestId, updatePayload);

    const otherPartyId = isRequester ? req.helperId : req.requesterId;
    if (otherPartyId) {
      await notificationsService.notifyUser(otherPartyId, {
        type: bothConfirmed ? 'handover_confirmed' : 'handover_pending_partner',
        refId: requestId,
        title: bothConfirmed ? 'Item Handover Verified' : 'Handover Confirmation Pending',
        message: bothConfirmed
          ? `Both parties verified physical handover of "${req.itemName}". Return tracking is now active.`
          : `${user.name || 'Partner'} confirmed handover of "${req.itemName}". Please verify on your screen to proceed.`
      });
    }

    return { bothConfirmed, auth };
  }

  // Two-Sided Authentication at Return Stage (PIN entry or mutual confirmation)
  async authenticateReturn(requestId, user, { pin, notes } = {}) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (req.status !== REQUEST_STATUS.HANDED_OVER && req.status !== REQUEST_STATUS.RETURNED) {
      throw new Error('Only handed-over items can be marked returned.');
    }

    const isRequester = req.requesterId === user.uid;
    const isHelper = req.helperId === user.uid;
    if (!isRequester && !isHelper) {
      throw new Error('Unauthorized: only participants can authenticate return.');
    }

    const auth = req.returnAuth || {
      code: Math.floor(1000 + Math.random() * 9000).toString(),
      requesterConfirmed: false,
      helperConfirmed: false,
      confirmedAt: null
    };

    let pinMatches = false;
    if (pin && String(pin).trim() === String(auth.code).trim()) {
      pinMatches = true;
    } else if (pin) {
      throw new Error('Invalid Return PIN. Please check the 4-digit code provided by the lender.');
    }

    if (isRequester) {
      auth.requesterConfirmed = true;
    }
    if (isHelper) {
      auth.helperConfirmed = true;
    }
    if (pinMatches) {
      // Entering lender's PIN proves in-person physical return
      auth.requesterConfirmed = true;
      auth.helperConfirmed = true;
    }

    const bothConfirmed = Boolean(auth.requesterConfirmed && auth.helperConfirmed);

    const returnCond = {
      returnedAt: req.returnCondition?.returnedAt || new Date().toISOString(),
      borrowerNotes: (notes || '').trim() || req.returnCondition?.borrowerNotes || '',
      borrowerId: req.type === 'request' ? req.requesterId : req.helperId
    };

    const updatePayload = {
      returnAuth: auth,
      returnCondition: returnCond,
      updatedAt: new Date().toISOString()
    };

    if (bothConfirmed) {
      updatePayload.status = REQUEST_STATUS.RETURNED;
      auth.confirmedAt = new Date().toISOString();
    }

    await store.updateDoc('requests', requestId, updatePayload);

    const otherPartyId = isRequester ? req.helperId : req.requesterId;
    if (otherPartyId) {
      await notificationsService.notifyUser(otherPartyId, {
        type: bothConfirmed ? 'item_returned' : 'return_pending_partner',
        refId: requestId,
        title: bothConfirmed ? 'Item Return Verified' : 'Return Confirmation Pending',
        message: bothConfirmed
          ? `Both parties confirmed equipment return for "${req.itemName}". Final condition check is now open.`
          : `${user.name || 'Partner'} initiated return for "${req.itemName}". Please verify physical receipt on your screen.`
      });
    }

    return { bothConfirmed, auth };
  }

  // Two-Sided Authentication at Completion Stage (Both parties must sign off)
  async authenticateCompletion(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (![REQUEST_STATUS.RETURNED, REQUEST_STATUS.HANDED_OVER].includes(req.status)) {
      throw new Error('Cannot complete request from this state.');
    }

    const isRequester = req.requesterId === user.uid;
    const isHelper = req.helperId === user.uid;
    if (!isRequester && !isHelper) {
      throw new Error('Unauthorized: only participants can authenticate completion.');
    }

    const auth = req.completionAuth || {
      requesterConfirmed: false,
      helperConfirmed: false,
      confirmedAt: null
    };

    if (isRequester) {
      auth.requesterConfirmed = true;
    }
    if (isHelper) {
      auth.helperConfirmed = true;
    }

    const bothConfirmed = Boolean(auth.requesterConfirmed && auth.helperConfirmed);

    const updatePayload = {
      completionAuth: auth,
      updatedAt: new Date().toISOString()
    };

    if (bothConfirmed) {
      updatePayload.status = REQUEST_STATUS.COMPLETED;
      updatePayload.completedAt = new Date().toISOString();
      auth.confirmedAt = new Date().toISOString();
    }

    await store.updateDoc('requests', requestId, updatePayload);

    const otherPartyId = isRequester ? req.helperId : req.requesterId;
    if (otherPartyId) {
      await notificationsService.notifyUser(otherPartyId, {
        type: bothConfirmed ? 'item_completed' : 'completion_pending_partner',
        refId: requestId,
        title: bothConfirmed ? 'Transaction Completed' : 'Completion Awaiting Your Confirmation',
        message: bothConfirmed
          ? `Transaction successfully verified and completed by both parties for "${req.itemName}"!`
          : `${user.name || 'Partner'} verified completion for "${req.itemName}". Please confirm on your screen to finalize.`
      });
    }

    return { bothConfirmed, auth };
  }

  // Shorthand / programmatically compatible handover
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

    const condition = {
      handedOverAt: req.handoverCondition?.handedOverAt || new Date().toISOString(),
      photoURL,
      notes: notes.trim() || req.handoverCondition?.notes || '',
      confirmedBy: Array.from(new Set([...(req.handoverCondition?.confirmedBy || []), user.uid]))
    };

    const auth = req.handoverAuth || {
      code: Math.floor(1000 + Math.random() * 9000).toString(),
      requesterConfirmed: true,
      helperConfirmed: true,
      confirmedAt: new Date().toISOString()
    };
    auth.requesterConfirmed = true;
    auth.helperConfirmed = true;
    auth.confirmedAt = new Date().toISOString();

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.HANDED_OVER,
      handoverCondition: condition,
      handoverAuth: auth,
      updatedAt: new Date().toISOString()
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

  // Shorthand / programmatically compatible return
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

    const auth = req.returnAuth || {
      code: Math.floor(1000 + Math.random() * 9000).toString(),
      requesterConfirmed: true,
      helperConfirmed: true,
      confirmedAt: new Date().toISOString()
    };
    auth.requesterConfirmed = true;
    auth.helperConfirmed = true;
    auth.confirmedAt = new Date().toISOString();

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.RETURNED,
      returnCondition: returnCond,
      returnAuth: auth,
      updatedAt: new Date().toISOString()
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

  // Shorthand / programmatically compatible completion
  async confirmReceivedInGoodCondition(requestId, user) {
    const req = await store.getDoc('requests', requestId);
    if (!req) throw new Error('Request not found.');

    if (![REQUEST_STATUS.RETURNED, REQUEST_STATUS.HANDED_OVER].includes(req.status)) {
      throw new Error('Cannot complete request from this state.');
    }

    const auth = req.completionAuth || {
      requesterConfirmed: true,
      helperConfirmed: true,
      confirmedAt: new Date().toISOString()
    };
    auth.requesterConfirmed = true;
    auth.helperConfirmed = true;
    auth.confirmedAt = new Date().toISOString();

    await store.updateDoc('requests', requestId, {
      status: REQUEST_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      completionAuth: auth,
      updatedAt: new Date().toISOString()
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
    if (!req) return null;

    if (req.status === REQUEST_STATUS.OPEN && req.neededBy && new Date(req.neededBy) < new Date()) {
      await store.deleteDoc('requests', requestId);
      return null;
    }

    // Auto-release inactive accepted requests where coordination deadline passed
    if (req.status === REQUEST_STATUS.ACCEPTED && req.handoverDeadline && new Date(req.handoverDeadline) < new Date()) {
      await store.updateDoc('requests', requestId, {
        status: REQUEST_STATUS.OPEN,
        helperId: null,
        helperName: null,
        acceptedAt: null,
        handoverDeadline: null,
        handoverAuth: null,
        returnAuth: null,
        completionAuth: null,
        meetingPoint: null,
        updatedAt: new Date().toISOString()
      });
      req.status = REQUEST_STATUS.OPEN;
      req.helperId = null;
      req.helperName = null;
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
    return store.subscribe('requests', (req) => {
      // Automatically filter out any expired open requests
      if (req.status === REQUEST_STATUS.OPEN && req.neededBy && new Date(req.neededBy) < new Date()) {
        return false;
      }

      // Automatically reopen inactive accepted requests whose handover deadline passed
      if (req.status === REQUEST_STATUS.ACCEPTED && req.handoverDeadline && new Date(req.handoverDeadline) < new Date()) {
        req.status = REQUEST_STATUS.OPEN;
        req.helperId = null;
        req.helperName = null;
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
        callback(null);
      } else {
        callback(item);
      }
    });
  }
}

export const requestsService = new RequestsService();
