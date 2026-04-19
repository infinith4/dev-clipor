export function getElementStackHeight(container: HTMLElement): number {
  const children = Array.from(container.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (children.length === 0) {
    return 0;
  }

  const top = Math.min(...children.map((child) => child.offsetTop));
  const bottom = Math.max(...children.map((child) => child.offsetTop + child.offsetHeight));

  return Math.max(0, bottom - top);
}
