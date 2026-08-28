import { useRef } from "react";

/**
 * Sauvegarde différée (debounce) par clé : chaque appel à `schedule` annule
 * la sauvegarde en attente pour cette clé et en programme une nouvelle,
 * `delay` millisecondes plus tard. `merge` reçoit la donnée encore en
 * attente (le cas échéant) et retourne celle qui sera effectivement
 * envoyée par `save`. `take` annule et retourne la sauvegarde en attente,
 * pour l'appliquer immédiatement (ex. avant de supprimer l'élément).
 */
export function usePendingSaves<K, V>() {
  const pending = useRef(
    new Map<K, { data: V; timer: ReturnType<typeof setTimeout> }>(),
  );

  function schedule(
    key: K,
    merge: (previous: V | undefined) => V,
    save: (data: V) => void,
    delay = 200,
  ) {
    const existing = pending.current.get(key);
    if (existing) clearTimeout(existing.timer);
    const data = merge(existing?.data);
    const timer = setTimeout(() => {
      pending.current.delete(key);
      save(data);
    }, delay);
    pending.current.set(key, { data, timer });
  }

  function take(key: K): V | undefined {
    const existing = pending.current.get(key);
    if (!existing) return undefined;
    clearTimeout(existing.timer);
    pending.current.delete(key);
    return existing.data;
  }

  return { schedule, take };
}
