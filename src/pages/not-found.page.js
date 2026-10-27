export async function renderNotFoundPage(container) {
  container.innerHTML = `
    <div class="container empty-state" style="padding-top: var(--space-12);">
      <h1 style="font-size: 4rem; color: var(--color-primary); line-height: 1;">404</h1>
      <h2 class="text-xl font-bold">Page Not Found</h2>
      <p class="text-sm text-muted">The resource or page you requested does not exist or has been moved.</p>
      <a href="#/" class="btn btn-primary" style="margin-top: var(--space-4);">Return to Safety</a>
    </div>
  `;
}
