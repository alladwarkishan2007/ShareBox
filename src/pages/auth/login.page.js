import { toast } from '../../components/toast.js';
import { authService } from '../../services/auth.service.js';
import { isValidEmail } from '../../utils/validators.js';

const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

export async function renderLoginPage(container) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="card auth-card">
        <div class="card-header">
          <h2 class="text-lg font-bold">Sign In to ShareBox</h2>
        </div>
        <div class="card-body">
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">
                Email Address <span class="required" style="color: var(--color-danger); font-weight: bold;">* (Compulsory)</span>
              </label>
              <input type="email" id="login-email" class="form-input" placeholder="name@example.com" required autocomplete="email">
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">
                Password <span class="required" style="color: var(--color-danger); font-weight: bold;">*</span>
              </label>
              <div class="password-input-group">
                <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
                <button type="button" class="password-toggle-btn" id="login-pwd-toggle" title="Show password" aria-label="Show password">
                  ${eyeIcon}
                </button>
              </div>
            </div>

            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--space-2);">
              Sign In
            </button>
          </form>
        </div>
        <div class="card-footer text-center">
          <span class="text-sm">Don't have an account? <a href="#/signup">Sign Up</a></span>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#login-submit-btn');
  const emailInput = container.querySelector('#login-email');
  const pwdInput = container.querySelector('#login-password');
  const pwdToggle = container.querySelector('#login-pwd-toggle');

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
    const email = emailInput.value.trim();
    const password = pwdInput.value;

    if (!email) {
      toast.error('Email address is compulsory. Please enter your email.');
      emailInput.focus();
      return;
    }

    if (!isValidEmail(email)) {
      toast.error('A valid email address is required (e.g. name@example.com).');
      emailInput.focus();
      return;
    }

    if (!password) {
      toast.error('Password is required. Please enter your password.');
      pwdInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const loggedUser = await authService.login(email, password);
      const profile = (await authService.getUserProfile(loggedUser.uid)) || loggedUser;
      toast.success('Signed in successfully!');
      
      // Navigate to destination based on role
      if (profile?.role === 'admin' || loggedUser?.role === 'admin') {
        window.location.hash = '#/admin';
      } else if (profile?.role === 'organizer' || loggedUser?.role === 'organizer') {
        window.location.hash = '#/organizer';
      } else {
        window.location.hash = '#/dashboard';
      }
    } catch (err) {
      toast.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}


