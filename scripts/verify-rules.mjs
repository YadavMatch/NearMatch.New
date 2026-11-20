/**
 * Firestore rules checks for the account-erasure path.
 *
 * Not named *.test.* on purpose: `bun test` must stay runnable without an
 * emulator. Run this one explicitly:
 *
 *   bun run test:rules
 *
 * which wraps it in `firebase emulators:exec --only firestore`.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const ALICE = 'alice';
const BOB = 'bob';
const MATCH_ID = `${ALICE}_${BOB}`;

const liveSummary = (uid, name) => ({
  uid,
  displayName: name,
  age: 28,
  photo: 'https://example.test/p.jpg',
  city: 'Mumbai',
  jobTitle: 'Designer',
});

const erasedSummary = (uid) => ({
  uid,
  displayName: '',
  age: 0,
  photo: '',
  city: '',
  jobTitle: '',
});

const profileFor = (uid, name) => ({
  uid,
  displayName: name,
  age: 28,
  gender: 'woman',
  interestedIn: ['man'],
  bio: 'hello',
  jobTitle: 'Designer',
  city: 'Mumbai',
  interests: ['Coffee'],
  photos: ['https://example.test/p.jpg'],
  approxLat: 19.06,
  approxLng: 72.83,
  isOnboarded: true,
  isVisible: true,
  isBanned: false,
  isDeleted: false,
  lastActiveAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

let testEnv;
let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  \u001b[31m✗\u001b[0m ${name}`);
    console.log(`      ${err && err.message ? err.message.split('\n')[0] : err}`);
  }
}

/** Seed documents bypassing rules. */
async function seed(writer) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await writer(ctx.firestore());
  });
}

const verified = (uid) => testEnv.authenticatedContext(uid, { email_verified: true }).firestore();

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-nearmatch',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  console.log('\nProfile erasure');
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'profiles', ALICE), profileFor(ALICE, 'Alice'));
    await setDoc(doc(db, 'profiles', BOB), profileFor(BOB, 'Bob'));
  });

  await check('owner deletes their own profile', async () => {
    await assertSucceeds(deleteDoc(doc(verified(ALICE), 'profiles', ALICE)));
  });
  await check('stranger cannot delete someone else’s profile', async () => {
    await assertFails(deleteDoc(doc(verified(ALICE), 'profiles', BOB)));
  });
  await check('unverified user cannot delete a profile', async () => {
    const db = testEnv.authenticatedContext(BOB, { email_verified: false }).firestore();
    await assertFails(deleteDoc(doc(db, 'profiles', BOB)));
  });
  await check('owner deletes their own private record', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'profiles', BOB, 'private', 'info'), { uid: BOB, email: 'b@example.test' });
    });
    await assertSucceeds(deleteDoc(doc(verified(BOB), 'profiles', BOB, 'private', 'info')));
  });

  console.log('\nMatch summary scrub');
  const freshMatch = async () => {
    await testEnv.clearFirestore();
    await seed(async (db) => {
      await setDoc(doc(db, 'profiles', ALICE), profileFor(ALICE, 'Alice'));
      await setDoc(doc(db, 'profiles', BOB), profileFor(BOB, 'Bob'));
      await setDoc(doc(db, 'matches', MATCH_ID), {
        userLow: ALICE,
        userHigh: BOB,
        participants: [ALICE, BOB],
        participantSummaries: {
          [ALICE]: liveSummary(ALICE, 'Alice'),
          [BOB]: liveSummary(BOB, 'Bob'),
        },
        compatibilityScore: 80,
        matchReasons: ['Nearby'],
        isActive: true,
        matchedAt: new Date(),
        updatedAt: new Date(),
      });
    });
  };

  await freshMatch();
  await check('participant blanks their own summary', async () => {
    await assertSucceeds(updateDoc(doc(verified(ALICE), 'matches', MATCH_ID), {
      [`participantSummaries.${ALICE}`]: erasedSummary(ALICE),
      updatedAt: serverTimestamp(),
    }));
  });

  await freshMatch();
  await check('participant cannot blank the other person’s summary', async () => {
    await assertFails(updateDoc(doc(verified(ALICE), 'matches', MATCH_ID), {
      [`participantSummaries.${BOB}`]: erasedSummary(BOB),
      updatedAt: serverTimestamp(),
    }));
  });

  await freshMatch();
  await check('scrub cannot smuggle in another field change', async () => {
    await assertFails(updateDoc(doc(verified(ALICE), 'matches', MATCH_ID), {
      [`participantSummaries.${ALICE}`]: erasedSummary(ALICE),
      compatibilityScore: 99,
      updatedAt: serverTimestamp(),
    }));
  });

  await freshMatch();
  await check('non-participant cannot scrub a summary', async () => {
    await assertFails(updateDoc(doc(verified('mallory'), 'matches', MATCH_ID), {
      [`participantSummaries.${ALICE}`]: erasedSummary(ALICE),
      updatedAt: serverTimestamp(),
    }));
  });

  await freshMatch();
  await check('scrub still works on a closed match', async () => {
    await seed(async (db) => {
      await updateDoc(doc(db, 'matches', MATCH_ID), { isActive: false, closedBy: BOB });
    });
    await assertSucceeds(updateDoc(doc(verified(ALICE), 'matches', MATCH_ID), {
      [`participantSummaries.${ALICE}`]: erasedSummary(ALICE),
      updatedAt: serverTimestamp(),
    }));
  });

  await freshMatch();
  await check('match still cannot be deleted outright', async () => {
    await assertFails(deleteDoc(doc(verified(ALICE), 'matches', MATCH_ID)));
  });

  console.log('\nSwipe erasure');
  const oldSwipe = async () => {
    await testEnv.clearFirestore();
    await seed(async (db) => {
      await setDoc(doc(db, 'profiles', ALICE), profileFor(ALICE, 'Alice'));
      await setDoc(doc(db, 'swipes', `${ALICE}_${BOB}`), {
        actorId: ALICE,
        targetId: BOB,
        action: 'like',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      });
    });
  };

  await oldSwipe();
  await check('actor cannot delete a stale swipe while their profile exists', async () => {
    await assertFails(deleteDoc(doc(verified(ALICE), 'swipes', `${ALICE}_${BOB}`)));
  });

  await oldSwipe();
  await check('actor can delete a stale swipe once their profile is gone', async () => {
    await seed(async (db) => { await deleteDoc(doc(db, 'profiles', ALICE)); });
    await assertSucceeds(deleteDoc(doc(verified(ALICE), 'swipes', `${ALICE}_${BOB}`)));
  });

  await oldSwipe();
  await check('a third party cannot delete someone else’s swipe', async () => {
    await seed(async (db) => { await deleteDoc(doc(db, 'profiles', ALICE)); });
    await assertFails(deleteDoc(doc(verified(BOB), 'swipes', `${ALICE}_${BOB}`)));
  });

  console.log('\nRetained by design');
  await testEnv.clearFirestore();
  await check('reports survive erasure', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'reports', 'r1'), {
        reporterId: ALICE,
        reportedId: BOB,
        reason: 'spam',
        createdAt: new Date(),
      });
    });
    await assertFails(deleteDoc(doc(verified(ALICE), 'reports', 'r1')));
  });
  await check('blocks the user created are removable', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'blocks', `${ALICE}_${BOB}`), {
        blockerId: ALICE,
        blockedId: BOB,
        createdAt: new Date(),
      });
    });
    await assertSucceeds(deleteDoc(doc(verified(ALICE), 'blocks', `${ALICE}_${BOB}`)));
  });

  console.log('\nMatch creation unaffected');
  await check('a match cannot be created with an already-erased summary', async () => {
    await testEnv.clearFirestore();
    await seed(async (db) => {
      await setDoc(doc(db, 'swipes', `${ALICE}_${BOB}`), { actorId: ALICE, targetId: BOB, action: 'like', createdAt: new Date() });
      await setDoc(doc(db, 'swipes', `${BOB}_${ALICE}`), { actorId: BOB, targetId: ALICE, action: 'like', createdAt: new Date() });
    });
    await assertFails(setDoc(doc(verified(ALICE), 'matches', MATCH_ID), {
      userLow: ALICE,
      userHigh: BOB,
      participants: [ALICE, BOB],
      participantSummaries: { [ALICE]: erasedSummary(ALICE), [BOB]: liveSummary(BOB, 'Bob') },
      compatibilityScore: 80,
      matchReasons: ['Nearby'],
      isActive: true,
      matchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  await testEnv.cleanup();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
