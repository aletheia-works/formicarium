// A run Worker that only reports its start-up: it announces its creation on
// the `formicarium-startup` channel and posts `started` when the test asks.
const channel = new BroadcastChannel('formicarium-startup');
let name: string | undefined;
channel.onmessage = (event: MessageEvent<{ started?: string }>) => {
  if (name !== undefined && event.data?.started === name)
    self.postMessage({ type: 'started' });
};
self.onmessage = (event: MessageEvent<{ type?: string; args?: string[] }>) => {
  if (event.data?.type !== 'run') return;
  name = event.data.args?.[0];
  channel.postMessage({ created: name });
};
