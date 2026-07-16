const getThemeButtons = () => Array.from(document.querySelectorAll('.theme-toggle-btn[data-theme-target]'));

const getPreferredTheme = () => {
  if (localStorage.getItem('color-theme')) {
    return localStorage.getItem('color-theme');
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const syncThemeButtons = (isCurrentlyDark = getPreferredTheme() === 'dark') => {
  getThemeButtons().forEach((btn) => {
    const isActive = btn.dataset.themeTarget === (isCurrentlyDark ? 'dark' : 'light');

    btn.classList.toggle('bg-white', isActive);
    btn.classList.toggle('dark:bg-gray-900', isActive);
    btn.classList.toggle('text-gray-900', isActive);
    btn.classList.toggle('dark:text-white', isActive);
    btn.classList.toggle('shadow-sm', isActive);
    btn.classList.toggle('text-gray-500', !isActive);
    btn.classList.toggle('dark:text-gray-400', !isActive);
  });
};

const applyTheme = (theme) => {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('color-theme', isDark ? 'dark' : 'light');
  syncThemeButtons(isDark);
};

const getThemeTarget = (node) => node?.closest('[data-theme-target]')?.dataset.themeTarget || null;

const setThemeTransitionOrigin = (toggleBtn) => {
  if (!toggleBtn) return;

  const rect = toggleBtn.getBoundingClientRect();
  const originX = rect.right;
  const originY = rect.top;
  const maxX = Math.max(originX, window.innerWidth - originX);
  const maxY = Math.max(originY, window.innerHeight - originY);
  const radius = Math.hypot(maxX, maxY);

  document.documentElement.style.setProperty('--theme-transition-x', `${originX}px`);
  document.documentElement.style.setProperty('--theme-transition-y', `${originY}px`);
  document.documentElement.style.setProperty('--theme-transition-radius', `${radius}px`);
};

const handleThemeToggleClick = (event) => {
  const toggleBtn = event.target.closest('.theme-toggle-btn');
  if (!toggleBtn) return;

  const targetTheme = getThemeTarget(event.target) || toggleBtn.dataset.themeTarget;
  const nextTheme = targetTheme || (document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  const commitThemeChange = () => applyTheme(nextTheme);

  setThemeTransitionOrigin(toggleBtn);

  if (document.startViewTransition) {
    document.startViewTransition(commitThemeChange);
  } else {
    commitThemeChange();
  }
};

syncThemeButtons();

if (!document.documentElement.dataset.themeToggleBound) {
  document.documentElement.dataset.themeToggleBound = 'true';
  document.addEventListener('click', handleThemeToggleClick);
  window.addEventListener('theme-toggle:sync', () => syncThemeButtons());
}