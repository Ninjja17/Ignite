export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/** Incremental Server-Sent Events parser that tolerates chunk boundaries anywhere in the stream. */
export class SseParser {
  private buffer = "";
  private dataLines: string[] = [];
  private eventName = "message";
  private lastId: string | undefined;

  push(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const messages: SseMessage[] = [];
    let newline: number;
    while ((newline = this.buffer.search(/\r\n|\r|\n/)) !== -1) {
      // A trailing "\r" may be the first half of a "\r\n" split across chunks; wait for more data.
      if (newline === this.buffer.length - 1 && this.buffer[newline] === "\r") break;
      const line = this.buffer.slice(0, newline);
      const sepLength = this.buffer.startsWith("\r\n", newline) ? 2 : 1;
      this.buffer = this.buffer.slice(newline + sepLength);
      const message = this.handleLine(line);
      if (message) messages.push(message);
    }
    return messages;
  }

  flush(): SseMessage[] {
    const messages: SseMessage[] = [];
    if (this.buffer.length > 0) {
      const message = this.handleLine(this.buffer.replace(/\r$/, ""));
      this.buffer = "";
      if (message) messages.push(message);
    }
    const last = this.handleLine("");
    if (last) messages.push(last);
    return messages;
  }

  private handleLine(line: string): SseMessage | null {
    if (line === "") {
      if (this.dataLines.length === 0) {
        this.eventName = "message";
        return null;
      }
      const message: SseMessage = { event: this.eventName, data: this.dataLines.join("\n"), id: this.lastId };
      this.dataLines = [];
      this.eventName = "message";
      return message;
    }
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") this.dataLines.push(value);
    else if (field === "event") this.eventName = value;
    else if (field === "id") this.lastId = value;
    return null;
  }
}
