import localUnitTest from './LocalUnit.test';
import replyTextTest from './ReplyText.test';
import navigationIntentTest from './NavigationIntent.test';
import resourceTwinTest from './ResourceTwin.test';
import barcodeIntakeTest from './BarcodeIntake.test';
import reminderPlannerTest from './ReminderPlanner.test';
import policyEngineTest from './PolicyEngine.test';

export default function testsuite() {
  localUnitTest();
  replyTextTest();
  navigationIntentTest();
  resourceTwinTest();
  barcodeIntakeTest();
  reminderPlannerTest();
  policyEngineTest();
}
