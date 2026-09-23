import { COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { useMemo } from "react";

import { useLearningPaths } from "~/api/queries/useLearningPaths";

export type NextCourseInPath = {
  courseId: string;
  title: string;
  learningPathTitle: string;
};

// Próximo curso acessível na primeira trilha (em que o usuário está matriculado)
// que contém o curso atual. Null quando não há trilha, é o último curso, ou o
// próximo ainda está bloqueado pela sequência.
export function useNextCourseInPath(courseId: string | undefined): NextCourseInPath | null {
  const { data } = useLearningPaths({ page: 1, perPage: 100 }, { enabled: Boolean(courseId) });

  return useMemo(() => {
    if (!courseId || !data?.data) return null;

    for (const path of data.data) {
      if (!path.isEnrolled) continue;

      const courses = [...path.courses].sort((a, b) => a.displayOrder - b.displayOrder);
      const index = courses.findIndex((course) => course.courseId === courseId);
      if (index === -1) continue;

      const next = courses[index + 1];
      if (!next || next.isLocked || next.progress === COURSE_PROGRESS_STATUSES.BLOCKED) continue;

      return { courseId: next.courseId, title: next.title, learningPathTitle: path.title };
    }

    return null;
  }, [courseId, data]);
}
