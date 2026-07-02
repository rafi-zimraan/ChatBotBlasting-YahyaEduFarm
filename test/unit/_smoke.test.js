const utils = require('../../src/js/utils');
const state = require('../../src/js/state');
const scheduler = require('../../src/js/scheduler');

test('smoke: modules load with mocked client/storage/groq', () => {
    expect(typeof utils.isAdminRequest).toBe('function');
    expect(state.scheduledBlasts).toEqual([]);
    expect(typeof scheduler.executeBlast).toBe('function');
});
