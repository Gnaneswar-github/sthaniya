/**
 * Pulls complete JSON objects out of text that is still arriving.
 *
 * The model streams its answer token by token. Rather than wait for the whole document, this
 * tracks braces (ignoring any inside strings) and parses each object the moment it closes.
 * Only objects carrying a `"ref"` are returned: nested pieces like `window` close first and are
 * skipped, and a wrapping `{"places":[…]}` parses to something without a top-level ref, which
 * the caller ignores. That makes it work whether the model writes JSON Lines or one big object.
 */
export class ObjectScanner {
  private text = "";
  private position = 0;
  private starts: number[] = [];
  private inString = false;
  private escaped = false;

  push(chunk: string): unknown[] {
    this.text += chunk;
    const found: unknown[] = [];

    for (; this.position < this.text.length; this.position++) {
      const ch = this.text[this.position];

      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }

      if (ch === '"') {
        this.inString = true;
      } else if (ch === "{") {
        this.starts.push(this.position);
      } else if (ch === "}") {
        const start = this.starts.pop();
        if (start === undefined) continue;
        const slice = this.text.slice(start, this.position + 1);
        if (!slice.includes('"ref"')) continue;
        try {
          found.push(JSON.parse(slice));
        } catch {
          // A malformed object is skipped; the next one may still be fine.
        }
      }
    }

    return found;
  }
}
