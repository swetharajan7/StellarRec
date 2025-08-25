export interface LogContext {
    [key: string]: any;
}
export declare class Logger {
    private winston;
    private context;
    constructor(context?: string);
    private createLogger;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error | LogContext, context?: LogContext): void;
    fatal(message: string, error?: Error | LogContext, context?: LogContext): void;
    http(message: string, context?: LogContext): void;
    log(level: string, message: string, context?: LogContext): void;
    child(additionalContext: LogContext): Logger;
    performance(operation: string, duration: number, context?: LogContext): void;
    security(event: string, context?: LogContext): void;
    audit(action: string, userId?: string, context?: LogContext): void;
    startTimer(label: string): () => void;
    structured(level: string, message: string, data: Record<string, any>): void;
}
export declare const defaultLogger: Logger;
export default Logger;
//# sourceMappingURL=logger.d.ts.map