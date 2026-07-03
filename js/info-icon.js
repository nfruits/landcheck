// Click-toggle for info-icon tooltips (hover works via CSS alone). Touch
// devices don't get hover, so a tap toggles the .tip-open state.

function setupInfoIcons() {
  document.querySelectorAll('.info-icon').forEach(el => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.info-icon.tip-open').forEach(o => {
        if (o !== el) o.classList.remove('tip-open');
      });
      el.classList.toggle('tip-open');
    });
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.info-icon.tip-open').forEach(el => el.classList.remove('tip-open'));
});

// ESC dismisses any open tooltip — completes the keyboard story now that the
// icons are reachable via :focus-visible.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.info-icon.tip-open').forEach(el => el.classList.remove('tip-open'));
  }
});

setupInfoIcons();

// Future modules that inject .info-icon elements after load (e.g. Block 2's
// My Places section) can call this to wire up the click toggle.
export { setupInfoIcons };
