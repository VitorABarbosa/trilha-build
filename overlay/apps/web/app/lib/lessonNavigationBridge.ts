import { useEffect, useState } from "react";

// Ponte entre a página da lição e blocos de conteúdo embutidos (ex.: visualizador
// de PDF) que querem oferecer "Próxima lição" sem conhecer a navegação do curso.
// A página publica se existe uma próxima lição acessível; o bloco pede a navegação.

const AVAILABILITY_EVENT = "trilha:lesson-next-availability";
const REQUEST_EVENT = "trilha:lesson-request-next";

let nextLessonAvailable = false;

const hasWindow = () => typeof window !== "undefined";

export function publishNextLessonAvailability(available: boolean) {
  nextLessonAvailable = available;
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<boolean>(AVAILABILITY_EVENT, { detail: available }));
}

export function requestNextLesson() {
  if (!hasWindow()) return;
  window.dispatchEvent(new Event(REQUEST_EVENT));
}

export function onNextLessonRequest(handler: () => void) {
  if (!hasWindow()) return () => {};
  window.addEventListener(REQUEST_EVENT, handler);
  return () => window.removeEventListener(REQUEST_EVENT, handler);
}

export function useNextLessonAvailability() {
  const [available, setAvailable] = useState(nextLessonAvailable);

  useEffect(() => {
    setAvailable(nextLessonAvailable);
    const handler = (event: Event) => setAvailable(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(AVAILABILITY_EVENT, handler);
    return () => window.removeEventListener(AVAILABILITY_EVENT, handler);
  }, []);

  return available;
}
