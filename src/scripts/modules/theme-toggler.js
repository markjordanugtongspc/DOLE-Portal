// Select all theme toggle buttons and icons
const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
const themeToggleDarkIcons = document.querySelectorAll('.theme-toggle-dark-icon');
const themeToggleLightIcons = document.querySelectorAll('.theme-toggle-light-icon');

// Detect if dark mode is active
const isDark = document.documentElement.classList.contains('dark') || 
  localStorage.getItem('color-theme') === 'dark' || 
  (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

// Synchronize all theme toggle icons
const syncIcons = (isCurrentlyDark) => {
  if (isCurrentlyDark) {
    themeToggleLightIcons.forEach(icon => icon.classList.remove('hidden'));
    themeToggleDarkIcons.forEach(icon => icon.classList.add('hidden'));
  } else {
    themeToggleDarkIcons.forEach(icon => icon.classList.remove('hidden'));
    themeToggleLightIcons.forEach(icon => icon.classList.add('hidden'));
  }
};

// Initial sync
syncIcons(isDark);

// Bind event listeners to all theme toggle buttons
themeToggleBtns.forEach(btn => {
  btn.addEventListener('click', function(e) {
    const toggleTheme = () => {
      // Toggle dark mode class on html
      const isNewDark = document.documentElement.classList.toggle('dark');
      
      // Save preference to localStorage
      localStorage.setItem('color-theme', isNewDark ? 'dark' : 'light');
      
      // Update all icons
      syncIcons(isNewDark);
    };

    if (document.startViewTransition) {
      document.startViewTransition(toggleTheme);
    } else {
      toggleTheme();
    }
  });
});
