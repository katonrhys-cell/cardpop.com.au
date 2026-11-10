import { describe, it, expect, vi, afterEach } from 'vitest';
import { withStepTimeout, createStepRunner, SaveStepTimeoutError } from '../../utils/saveSteps.js';

afterEach(() => { vi.useRealTimers(); });

describe('withStepTimeout', () => {
  it('passes a result through', async () => {
    await expect(withStepTimeout(Promise.resolve(7), 1000, 'Doing it')).resolves.toBe(7);
  });

  it('passes an error through', async () => {
    await expect(withStepTimeout(Promise.reject(new Error('nope')), 1000, 'Doing it')).rejects.toThrow('nope');
  });

  it('fails a step that never finishes, naming the step', async () => {
    vi.useFakeTimers();
    const hung = new Promise(() => {});
    const p = withStepTimeout(hung, 90_000, 'Uploading cover image');
    const assertion = expect(p).rejects.toMatchObject({
      name: 'SaveStepTimeoutError',
      step: 'Uploading cover image',
      message: expect.stringContaining('uploading cover image for over 90 seconds'),
    });
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
  });
});

describe('createStepRunner', () => {
  it('announces each step and reports only timeouts', async () => {
    vi.useFakeTimers();
    const onStep = vi.fn();
    const onTimeout = vi.fn();
    const run = createStepRunner({ onStep, onTimeout });

    await expect(run('Saving the event', async () => 'ok')).resolves.toBe('ok');
    await expect(run('Saving the event', async () => { throw new Error('rls'); })).rejects.toThrow('rls');
    expect(onTimeout).not.toHaveBeenCalled();

    const stalled = run('Uploading photo 1 of 3', () => new Promise(() => {}), 5_000);
    const assertion = expect(stalled).rejects.toBeInstanceOf(SaveStepTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;

    expect(onStep.mock.calls.map((c) => c[0])).toEqual(['Saving the event', 'Saving the event', 'Uploading photo 1 of 3']);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout.mock.calls[0][0].step).toBe('Uploading photo 1 of 3');
  });
});
