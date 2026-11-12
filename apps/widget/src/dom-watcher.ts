/*
 * One shared, batched MutationObserver for the whole widget (the UserWay pattern).
 * Several features need to know about new page content; the page pays for one observer,
 * and features get one batch per burst of changes instead of a callback per element.
 */
type Listener = (added: Element[]) => void;

const QUIET_MS = 100;    // report once the page has stopped changing for this long...
const MAX_WAIT_MS = 500; // ...but never wait longer than this during constant changes

const listeners = new Set<Listener>();
const watched = new WeakSet<Node>();
let pending = new Set<Element>();
let quietTimer: ReturnType<typeof setTimeout> | undefined;
let maxTimer: ReturnType<typeof setTimeout> | undefined;

const observer = new MutationObserver((records) => {
    for (const record of records) {
        record.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) pending.add(node as Element);
            // Text filled into an existing element (e.g. an empty <span> filled in later): report that element
            else if (node.nodeType === Node.TEXT_NODE && node.parentElement) pending.add(node.parentElement);
        });

    }
    if (pending.size) schedule();
});

function schedule(): void {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(flush, QUIET_MS);
    maxTimer ??= setTimeout(flush, MAX_WAIT_MS);
}

function flush(): void {
    clearTimeout(quietTimer);
    clearTimeout(maxTimer);
    quietTimer = maxTimer = undefined;
    const added = [...pending].filter((el) => el.isConnected); // skip elements already removed again
    pending = new Set();
    if (added.length) listeners.forEach((fn) => fn(added));
}

/** Watch a tree for added elements: the document, or an open shadow root (the document's observer can't see inside those). */
export function watchTree(root: Document | ShadowRoot): void {
    if (watched.has(root)) return;
    watched.add(root);
    observer.observe(root, { childList: true, subtree: true });
}

/** Get a batch of added elements after each burst of page changes. Returns an unsubscribe function. */
export function onElementsAdded(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
