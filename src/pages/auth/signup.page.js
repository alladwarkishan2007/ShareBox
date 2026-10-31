import { toast } from '../../components/toast.js';
import { authService } from '../../services/auth.service.js';
import { isValidEmail } from '../../utils/validators.js';

const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

export async function renderSignupPage(container) {
  container.innerHTML = `
    <div class="auth-container" style="padding: var(--space-4) var(--space-4); min-height: calc(100vh - 120px);">
      <div class="card auth-card" style="max-width: 540px; width: 100%;">
        <div class="card-body" style="padding: var(--space-6);">
          <h2 class="text-xl font-bold" style="margin-bottom: var(--space-1);">Create Campus Account</h2>
          <p class="text-sm text-muted" style="margin-bottom: var(--space-4);">
            Quick campus equipment sharing across departments and clubs.
          </p>

          <form id="signup-form">
            <div class="form-group" style="margin-bottom: var(--space-3);">
              <div class="flex justify-between items-center">
                <label class="form-label" for="signup-name" style="margin-bottom: 0;">Unique Username / Full Name <span class="required" style="color: var(--color-danger); font-weight: bold;">*</span></label>
                <span class="text-xs text-subtle" style="font-size: 11px;">Must be unique</span>
              </div>
              <input type="text" id="signup-name" class="form-input" placeholder="e.g. Alex Rivers or alex_rivers" required autocomplete="name" style="padding: 0.6rem 0.85rem; margin-top: 4px;">
            </div>

            <div class="form-group" style="margin-bottom: var(--space-3);">
              <label class="form-label" for="signup-email">
                Email Address <span class="required" style="color: var(--color-danger); font-weight: bold;">* (Compulsory)</span>
              </label>
              <input type="email" id="signup-email" class="form-input" placeholder="alex@example.com" required autocomplete="email" style="padding: 0.6rem 0.85rem;">
            </div>

            <div class="form-group" style="margin-bottom: var(--space-3);">
              <label class="form-label" for="signup-password">Password <span class="required">*</span></label>
              <div class="password-input-group">
                <input type="password" id="signup-password" class="form-input" placeholder="•••••••• (Min 6 characters)" required autocomplete="new-password" style="padding: 0.6rem 0.85rem;">
                <button type="button" class="password-toggle-btn" id="signup-pwd-toggle" title="Show password" aria-label="Show password">
                  ${eyeIcon}
                </button>
              </div>
            </div>

            <div class="flex gap-3" style="margin-bottom: var(--space-3);">
              <div class="form-group flex-1" style="margin-bottom: 0;">
                <label class="form-label" for="signup-dept">Department <span class="required">*</span></label>
                <select id="signup-dept" class="form-select" required style="padding: 0.6rem 0.85rem;">
                  <option value="" disabled selected>Select Department</option>
                  <option value="AIDS - Artificial Intelligence and Data Science">AIDS - Artificial Intelligence and Data Science</option>
                  <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Communication">Electronics & Communication</option>
                  <option value="Electrical & Electronics">Electrical & Electronics</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Management Studies">Management Studies</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div class="form-group flex-1" style="margin-bottom: 0;">
                <label class="form-label" for="signup-year">Year / Role <span class="required">*</span></label>
                <select id="signup-year" class="form-select" required style="padding: 0.6rem 0.85rem;">
                  <option value="" disabled selected>Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="Faculty / Staff">Faculty / Staff</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: var(--space-4);">
              <label class="form-label" for="signup-phone">Phone Number (Optional)</label>
              <input type="tel" id="signup-phone" class="form-input" placeholder="+1 (555) 000-0000" autocomplete="tel" style="padding: 0.6rem 0.85rem;">
            </div>

            <button type="submit" id="signup-submit-btn" class="btn btn-primary" style="width: 100%; padding: 0.75rem 1.25rem; font-size: var(--font-base); font-weight: 600;">
              Create Account
            </button>
          </form>
        </div>
        <div class="card-footer text-center" style="padding: var(--space-3) var(--space-5);">
          <span class="text-sm">Already have an account? <a href="#/login">Sign In</a></span>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#signup-form');
  const submitBtn = container.querySelector('#signup-submit-btn');
  const pwdInput = container.querySelector('#signup-password');
  const pwdToggle = container.querySelector('#signup-pwd-toggle');

  // Password Visibility Toggle
  let isPasswordVisible = false;
  pwdToggle.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    pwdInput.type = isPasswordVisible ? 'text' : 'password';
    pwdToggle.innerHTML = isPasswordVisible ? eyeOffIcon : eyeIcon;
    pwdToggle.setAttribute('aria-label', isPasswordVisible ? 'Hide password' : 'Show password');
    pwdToggle.setAttribute('title', isPasswordVisible ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('#signup-name').value.trim();
    const email = form.querySelector('#signup-email').value.trim();
    const password = form.querySelector('#signup-password').value;
    const department = form.querySelector('#signup-dept').value;
    const year = form.querySelector('#signup-year').value;
    const phone = form.querySelector('#signup-phone').value.trim();

    if (!email) {
      toast.error('Email address is compulsory. Please enter your email.');
      form.querySelector('#signup-email').focus();
      return;
    }

    if (!isValidEmail(email)) {
      toast.error('A valid email address is required (e.g. name@example.com).');
      form.querySelector('#signup-email').focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const created = await authService.signUp({ name, email, password, department, year, phone });
      if (created && created.status === 'pending') {
        toast.info('Registration submitted! Membership approval request sent to administrator.');
      } else {
        toast.success('Account created successfully! Welcome to ShareBox.');
      }
      window.location.hash = '#/dashboard';
    } catch (err) {
      toast.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}
