import localUnitTest from './LocalUnit.test';
import replyTextTest from './ReplyText.test';
import navigationIntentTest from './NavigationIntent.test';
import resourceTwinTest from './ResourceTwin.test';
import barcodeIntakeTest from './BarcodeIntake.test';
import reminderPlannerTest from './ReminderPlanner.test';
import policyEngineTest from './PolicyEngine.test';
import localRestoreTest from './LocalRestore.test';
import commandsTest from './Commands.test';
import resourceDomainTest from './ResourceDomain.test';
import workoutPlannerTest from './WorkoutPlanner.test';

export default function testsuite() {
  localUnitTest();
  replyTextTest();
  navigationIntentTest();
  resourceTwinTest();
  barcodeIntakeTest();
  reminderPlannerTest();
  policyEngineTest();
  localRestoreTest();
  commandsTest();
  resourceDomainTest();
  workoutPlannerTest();
}
