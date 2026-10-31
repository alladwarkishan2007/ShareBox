import { store } from './store.js';
import { isValidEmail, validatePassword } from '../utils/validators.js';
import { USER_ROLES } from '../config/constants.js';

class AuthService {
  async signUp({ name, email, password, department, year, phone = '', role = USER_ROLES.MEMBER, status }) {
    if (!name || !name.trim()) {
      throw new Error('Username / Full Name is compulsory. Please choose a username.');
    }

    if (name.trim().length < 2) {
      throw new Error('Username must be at least 2 characters long.');
    }

    if (!isValidEmail(email)) {
      throw new Error('Please provide a valid email address.');
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.message);
    }

    const userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      year: year.trim(),
      phone: phone.trim(),
      photoURL: '',
      role,
      ...(status ? { status } : {})
    };

    return await store.signUp(userData, password);
  }

  async login(email, password) {
    if (!email || !email.trim()) {
      throw new Error('Email address is compulsory. Please enter your email.');
    }
    if (!password) {
      throw new Error('Password is compulsory. Please enter your password.');
    }
    return await store.login(email.trim(), password);
  }

  async logout() {
    await store.logout();
  }

  async resetPassword(email) {
    if (!isValidEmail(email)) {
      throw new Error('Please provide a valid email address.');
    }
    await store.resetPassword(email);
  }

  async getUserProfile(uid) {
    if (!uid) return null;
    return await store.getDoc('users', uid);
  }

  async updateUserProfile(uid, data) {
    const allowedFields = ['name', 'phone', 'photoURL', 'department', 'year'];
    const filtered = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }
    if (filtered.name) {
      const cleanName = filtered.name.trim();
      if (cleanName.length < 2) {
        throw new Error('Username must be at least 2 characters long.');
      }
      const allUsers = await store.getDocs('users');
      const conflict = allUsers.find(u => (u.uid || u.id) !== uid && u.name && u.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (conflict) {
        throw new Error(`The username "${cleanName}" is already taken. Please choose another username.`);
      }
    }
    await store.updateDoc('users', uid, filtered);
  }

  onAuthChange(callback) {
    return store.onAuth(callback);
  }
}

export const authService = new AuthService();
