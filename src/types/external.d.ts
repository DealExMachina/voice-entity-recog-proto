// Type declarations for external modules
declare module 'mailparser' {
  export function simpleParser(source: any, callback: (err: Error | null, parsed: any) => void): void;
  export function simpleParser(source: any): Promise<any>;
}

declare module 'imap' {
  export default any;
}