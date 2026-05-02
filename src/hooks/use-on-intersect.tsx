import * as React from "react";

export function useOnIntersect<T extends HTMLElement | null>({
  ref,
  onObserv,
}: {
  ref: React.RefObject<T>;
  onObserv: () => void;
}) {
  React.useEffect(() => {
    if (!ref) {
      throw new Error("[useOnIntersect] ref is not set");
    }

    const observ = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onObserv();
        }
      },
      { threshold: [0, 1] }
    );

    const el = ref?.current;

    if (!el) return;

    observ.observe(el);

    return () => {
      if (el) {
        observ.unobserve(el);
      }
    };
  }, [onObserv, ref]);

  return null;
}
