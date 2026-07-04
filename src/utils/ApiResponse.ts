export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: any;

  constructor(success: boolean, message: string, data: T | null = null, meta?: any) {
    this.success = success;
    this.message = message;
    this.data = data;
    if (meta) {
      this.meta = meta;
    }
  }

  static success<T>(message: string, data: T | null = null, meta?: any) {
    return new ApiResponse(true, message, data, meta);
  }

  static error(message: string, meta?: any) {
    return new ApiResponse(false, message, null, meta);
  }
}
