import { store } from './store.js';

class EventsService {
  async getEvents() {
    const events = await store.getDocs('events');
    return events.filter(e => e.isActive !== false);
  }

  async getEventById(eventId) {
    return await store.getDoc('events', eventId);
  }

  async createEvent(eventData, creator) {
    const id = 'evt_' + Math.random().toString(36).substring(2, 9);
    const newEvent = {
      id,
      title: eventData.title.trim(),
      description: eventData.description.trim(),
      type: eventData.type,
      venue: eventData.venue.trim(),
      joinCode: eventData.joinCode.trim().toUpperCase(),
      rules: eventData.rules.trim(),
      createdBy: creator.uid,
      creatorName: creator.name || creator.email,
      isActive: true,
      memberCount: 1,
      startAt: eventData.startAt || null,
      endAt: eventData.endAt || null,
      createdAt: new Date().toISOString()
    };

    await store.setDoc('events', id, newEvent);

    // Add creator as member
    await store.setDoc('event_members', `${id}_${creator.uid}`, {
      eventId: id,
      userId: creator.uid,
      role: 'organizer',
      joinedAt: new Date().toISOString()
    });

    return id;
  }

  async joinEvent(eventId, userId, joinCode) {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found.');

    if (event.joinCode && event.joinCode.toUpperCase() !== joinCode.trim().toUpperCase()) {
      throw new Error('Invalid event join code.');
    }

    const membershipId = `${eventId}_${userId}`;
    const existing = await store.getDoc('event_members', membershipId);
    if (existing) {
      return true; // Already joined
    }

    await store.setDoc('event_members', membershipId, {
      eventId,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString()
    });

    // Increment member count
    await store.updateDoc('events', eventId, {
      memberCount: (event.memberCount || 1) + 1
    });

    return true;
  }

  async isMember(eventId, userId) {
    if (eventId === 'campus-general') return true;
    const membership = await store.getDoc('event_members', `${eventId}_${userId}`);
    return !!membership;
  }

  async getEventMembers(eventId) {
    const allMemberships = await store.getDocs('event_members');
    const memberships = allMemberships.filter(m => m.eventId === eventId);
    const allUsers = await store.getDocs('users');
    const userMap = new Map(allUsers.map(u => [u.uid, u]));

    const event = await this.getEventById(eventId);
    const memberList = [];
    const seenUids = new Set();

    memberships.forEach(m => {
      const u = userMap.get(m.userId);
      seenUids.add(m.userId);
      memberList.push({
        userId: m.userId,
        name: u?.name || 'Student Member',
        branch: u?.department || 'General Branch',
        role: u?.role || m.role || 'member'
      });
    });

    if (event && event.createdBy && !seenUids.has(event.createdBy)) {
      const creator = userMap.get(event.createdBy);
      memberList.unshift({
        userId: event.createdBy,
        name: creator?.name || event.creatorName || 'Event Creator',
        branch: creator?.department || 'General Branch',
        role: creator?.role || 'organizer'
      });
    }

    return memberList;
  }

  subscribeEvents(callback) {
    return store.subscribe('events', (e) => e.isActive !== false, callback);
  }
}

export const eventsService = new EventsService();
