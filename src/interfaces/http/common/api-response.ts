export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, any>;
}