const { EventBus } = require('./temp/main/event-bus.js');

async function testDuplicatePrevention() {
  const bus = EventBus.getInstance();
  bus.reset();
  
  let count = 0;
  const listener = () => { count++; };
  
  bus.subscribe('clipboard:changed', listener);
  bus.subscribe('clipboard:changed', listener); // Duplicate!
  
  bus.publish('clipboard:changed', 'test');
  
  if (count === 1) {
    console.log('✅ TEST 1 PASSED: Duplicate subscription prevented.');
  } else {
    console.error('❌ TEST 1 FAILED: Expected listener to run 1 time, ran', count);
  }
}

async function testLoopDetection() {
  const bus = EventBus.getInstance();
  bus.reset();
  
  let aCount = 0;
  let bCount = 0;
  
  // A triggers B
  bus.subscribe('clipboard:changed', (text) => {
    aCount++;
    bus.publish('browser:navigation', 'https://example.com');
  }, { name: 'A' });
  
  // B triggers A (Loop!)
  bus.subscribe('browser:navigation', (url) => {
    bCount++;
    bus.publish('clipboard:changed', 'loop');
  }, { name: 'B' });
  
  // Publish A
  const result = bus.publish('clipboard:changed', 'init');
  
  // Should stop executing when cycle is detected
  if (aCount === 1 && bCount === 1) {
    console.log('✅ TEST 2 PASSED: Loop detected and halted recursion safely.');
  } else {
    console.error('❌ TEST 2 FAILED: Loop was not halted correctly. aCount:', aCount, 'bCount:', bCount);
  }
}

async function testErrorIsolation() {
  const bus = EventBus.getInstance();
  bus.reset();
  
  let successCount = 0;
  
  // Listener 1: Throws error
  bus.subscribe('clipboard:changed', () => {
    throw new Error('Sync throw in listener 1');
  }, { name: 'Thrower1' });
  
  // Listener 2: Runs successfully
  bus.subscribe('clipboard:changed', () => {
    successCount++;
  }, { name: 'Success1' });
  
  bus.publish('clipboard:changed', 'error-test');
  
  if (successCount === 1) {
    console.log('✅ TEST 3 PASSED: Sync error isolation succeeded. Throws did not crash the publisher.');
  } else {
    console.error('❌ TEST 3 FAILED: Sync error in one listener blocked subsequent listeners.');
  }
}

async function testAsyncRetriesAndBackoff() {
  const bus = EventBus.getInstance();
  bus.reset();
  
  let executionCount = 0;
  
  bus.subscribe('clipboard:changed', async (text) => {
    executionCount++;
    throw new Error('Async execution failure');
  }, { name: 'RetryTarget', retries: 3, backoffMs: 50 });
  
  const startTime = Date.now();
  
  // We use publishAsync to wait for retries to complete
  try {
    await bus.publishAsync('clipboard:changed', 'retry-test');
  } catch (err) {
    // Expected to propagate the failure after exhausted retries
  }
  
  const duration = Date.now() - startTime;
  
  // Executed 4 times: 1 initial + 3 retries
  // Delay calculation:
  // Retry 1: 50ms
  // Retry 2: 100ms
  // Retry 3: 200ms
  // Total delay: ~350ms
  const correctCount = (executionCount === 4);
  const correctDelay = (duration >= 350);
  
  if (correctCount && correctDelay) {
    console.log(`✅ TEST 4 PASSED: Async retries executed ${executionCount} times with exponential backoff (duration: ${duration}ms).`);
  } else {
    console.error(`❌ TEST 4 FAILED: Retries or backoff failed. executionCount: ${executionCount} (expected 4), duration: ${duration}ms (expected >= 350ms).`);
  }
}

async function testUnsubscribe() {
  const bus = EventBus.getInstance();
  bus.reset();
  
  let count = 0;
  const listener = () => { count++; };
  
  bus.subscribe('clipboard:changed', listener);
  bus.publish('clipboard:changed', 'first');
  
  bus.unsubscribe('clipboard:changed', listener);
  bus.publish('clipboard:changed', 'second');
  
  if (count === 1) {
    console.log('✅ TEST 5 PASSED: Unsubscribe worked correctly.');
  } else {
    console.error('❌ TEST 5 FAILED: Listener was still executed after unsubscribe. count:', count);
  }
}

async function run() {
  console.log('=== JARVIS V3 Event Bus Verification ===\n');
  await testDuplicatePrevention();
  await testLoopDetection();
  await testErrorIsolation();
  await testAsyncRetriesAndBackoff();
  await testUnsubscribe();
  console.log('\n=== Verification Finished ===');
}

run();
