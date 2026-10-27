import { store } from './store.js';
import { notificationsService } from './notifications.service.js';

class ReportsService {
  async createDamageReport({ requestId, eventId, ownerUser, borrowerId, description, photoFiles = [] }) {
    const id = 'dmg_' + Math.random().toString(36).substring(2, 9);
    const photos = [];

    for (const file of photoFiles) {
      const url = await store.uploadFile(file, `damage_reports/${id}/${file.name}`);
      photos.push(url);
    }

    const report = {
      id,
      requestId,
      eventId: eventId || 'campus-general',
      ownerId: ownerUser.uid,
      ownerName: ownerUser.name || ownerUser.email,
      borrowerId,
      description: description.trim(),
      photos,
      borrowerResponse: null,
      status: 'submitted', // 'submitted' | 'under_review' | 'resolved'
      decision: null,
      createdAt: new Date().toISOString()
    };

    await store.setDoc('damageReports', id, report);

    // Update Request status to damage_reported
    await store.updateDoc('requests', requestId, {
      status: 'damage_reported'
    });

    // Notify borrower
    await notificationsService.notifyUser(borrowerId, {
      type: 'damage_filed',
      refId: id,
      title: 'Damage Report Filed',
      message: `${ownerUser.name || 'Owner'} reported damage on borrowed item. Please provide your rebuttal response.`
    });

    return id;
  }

  async submitBorrowerResponse(reportId, borrowerUser, responseText) {
    const report = await store.getDoc('damageReports', reportId);
    if (!report) throw new Error('Damage report not found.');

    if (report.borrowerId !== borrowerUser.uid) {
      throw new Error('Only the borrower can respond to this damage report.');
    }

    const updated = {
      borrowerResponse: responseText.trim(),
      status: 'under_review',
      respondedAt: new Date().toISOString()
    };

    await store.updateDoc('damageReports', reportId, updated);

    // Notify owner
    await notificationsService.notifyUser(report.ownerId, {
      type: 'damage_response',
      refId: reportId,
      title: 'Borrower Responded to Damage Report',
      message: `${borrowerUser.name || 'Borrower'} has submitted their statement on report ${reportId}.`
    });

    return true;
  }

  async resolveReport({ reportId, reviewerUser, action, restrictionDays = 0, note = '' }) {
    const report = await store.getDoc('damageReports', reportId);
    if (!report) throw new Error('Damage report not found.');

    const decidedAt = new Date().toISOString();
    const decision = {
      action, // 'warning' | 'restriction' | 'compensation_required' | 'dismissed'
      restrictionDays: Number(restrictionDays) || 0,
      note: note.trim(),
      reviewerId: reviewerUser.uid,
      reviewerName: reviewerUser.name || reviewerUser.email,
      reviewerRole: reviewerUser.role,
      decidedAt
    };

    await store.updateDoc('damageReports', reportId, {
      status: 'resolved',
      decision
    });

    // Mark request as completed / resolved
    await store.updateDoc('requests', report.requestId, {
      status: 'completed'
    });

    // Apply penalty to borrower if action is warning or restriction
    const borrower = await store.getDoc('users', report.borrowerId);
    if (borrower) {
      const updates = {};
      if (action === 'warning') {
        updates.warningsCount = (borrower.warningsCount || 0) + 1;
      } else if (action === 'restriction' && restrictionDays > 0) {
        const restrictedUntil = new Date(Date.now() + restrictionDays * 86400000).toISOString();
        updates.restrictedUntil = restrictedUntil;
        updates.warningsCount = (borrower.warningsCount || 0) + 1;
      }

      if (Object.keys(updates).length > 0) {
        await store.updateDoc('users', report.borrowerId, updates);
      }

      // Notify borrower of decision
      await notificationsService.notifyUser(report.borrowerId, {
        type: 'penalty_imposed',
        refId: reportId,
        title: 'Damage Dispute Decision Issued',
        message: `Decision: ${action.toUpperCase()}. ${note ? `Note: ${note}` : ''} ${restrictionDays > 0 ? `Restricted for ${restrictionDays} day(s).` : ''}`
      });
    }

    // Notify owner of decision
    await notificationsService.notifyUser(report.ownerId, {
      type: 'report_resolved',
      refId: reportId,
      title: 'Damage Dispute Resolved',
      message: `Organizer decided: ${action}. Note: ${note || 'No additional note'}.`
    });

    return decision;
  }

  async getReportsByEvent(eventId) {
    const reports = await store.getDocs('damageReports');
    if (eventId && eventId !== 'all') {
      return reports.filter(r => r.eventId === eventId);
    }
    return reports;
  }

  async getReportById(reportId) {
    return await store.getDoc('damageReports', reportId);
  }

  subscribeReports(eventId, callback) {
    return store.subscribe('damageReports', (r) => {
      if (eventId && eventId !== 'all' && r.eventId !== eventId) return false;
      return true;
    }, (items) => {
      const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(sorted);
    });
  }
}

export const reportsService = new ReportsService();
