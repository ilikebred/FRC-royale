// Wake the multiplayer clock independently of rendering in a background tab.
setInterval(()=>postMessage('tick'),33);
