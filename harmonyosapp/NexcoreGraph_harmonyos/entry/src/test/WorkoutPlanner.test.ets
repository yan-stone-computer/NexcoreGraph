import { describe, expect, it } from '@ohos/hypium';
import {
  buildWorkoutPlan, calculateBmi, WorkoutExercise, WorkoutInput, WorkoutSession
} from '../main/ets/common/WorkoutPlanner';

function baseInput(): WorkoutInput {
  const input = new WorkoutInput();
  input.heightCm = 170;
  input.weightKg = 68;
  input.age = 30;
  input.weeklyDays = 3;
  input.level = 'beginner';
  input.goal = 'general';
  input.equipment = [];
  return input;
}

export default function workoutPlannerTest() {
  describe('workoutPlanner', () => {
    it('calculates bmi from body data', 0, () => {
      expect(Math.round(calculateBmi(170, 68) * 10) / 10).assertEqual(23.5);
    });

    it('rejects impossible body data', 0, () => {
      const input = baseInput();
      input.heightCm = 0;
      expect(buildWorkoutPlan(input).valid).assertFalse();
    });

    it('generates the requested number of weekly sessions', 0, () => {
      const plan = buildWorkoutPlan(baseInput());
      expect(plan.valid).assertTrue();
      expect(plan.sessions.length).assertEqual(3);
    });

    it('uses only available equipment', 0, () => {
      const input = baseInput();
      input.equipment = ['哑铃'];
      const plan = buildWorkoutPlan(input);
      const invalid = plan.sessions.some((session: WorkoutSession): boolean =>
        session.exercises.some((exercise: WorkoutExercise): boolean =>
          exercise.equipment !== '' && input.equipment.indexOf(exercise.equipment) < 0));
      expect(invalid).assertFalse();
    });

    it('is deterministic for identical body data and equipment', 0, () => {
      const first = buildWorkoutPlan(baseInput());
      const second = buildWorkoutPlan(baseInput());
      expect(first.summary).assertEqual(second.summary);
    });
  });
}
