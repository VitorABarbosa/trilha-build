import { useEffect, useState } from "react";

// Ponte entre a página da lição e blocos de conteúdo embutidos (ex.: visualizador
// de PDF) que querem oferecer "Próxima lição" / "Próximo curso" sem conhecer a
// navegação do curso. A página publica se existe um próximo passo acessível e qual
// é (lição ou curso da trilha); o bloco pede a navegação.

export type NextStepTarget = "lesson" | "course";
export type NextStepState = { available: boolean; target: NextStepTarget };

const AVAILABILITY_EVENT = "trilha:lesson-next-availability";
const REQUEST_EVENT = "trilha:lesson-request-next";

let current: NextStepState = { available: false, target: "lesson" };

const hasWindow = () => typeof window !== "undefined";

export function publishNextLessonAvailability(available: boolean, target: NextStepTarget = "lesson") {
  current = { available, target };
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<NextStepState>(AVAILABILITY_EVENT, { detail: current }));
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

export function useNextLessonAvailability(): NextStepState {
  const [state, setState] = useState<NextStepState>(current);

  useEffect(() => {
    setState(current);
    const handler = (event: Event) => setState((event as CustomEvent<NextStepState>).detail);
    window.addEventListener(AVAILABILITY_EVENT, handler);
    return () => window.removeEventListener(AVAILABILITY_EVENT, handler);
  }, []);

  return state;
}
