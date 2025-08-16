import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'counselor' | 'admin';
  profileComplete: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    deadlineReminders: boolean;
    aiInsights: boolean;
    universityUpdates: boolean;
  };
  privacy: {
    profileVisibility: 'private' | 'counselors' | 'public';
    dataSharing: boolean;
    analyticsOptOut: boolean;
  };
  language: string;
  timezone: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'counselor';
  schoolCode?: string;
  inviteCode?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    tokens: AuthTokens;
  };
}

class AuthService {
  private apiClient = axios.create({
    baseURL: `${API_BASE_URL}/auth`,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add request interceptor to include auth token
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token refresh
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshToken();
            const token = this.getAccessToken();
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.apiClient(originalRequest);
            }
          } catch (refreshError) {
            this.logout();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post('/register', userData);
      
      if (response.data.success) {
        this.storeTokens(response.data.data.tokens);
        this.storeUser(response.data.data.user);
      }

      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post('/login', credentials);
      
      if (response.data.success) {
        this.storeTokens(response.data.data.tokens);
        this.storeUser(response.data.data.user);
      }

      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      
      if (refreshToken) {
        await this.apiClient.post('/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
      this.clearUser();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<AuthTokens> {
    try {
      const refreshToken = this.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.apiClient.post('/refresh', { refreshToken });
      
      if (response.data.success) {
        this.storeTokens(response.data.data.tokens);
        return response.data.data.tokens;
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    try {
      const response = await this.apiClient.get('/profile');
      
      if (response.data.success) {
        this.storeUser(response.data.data.user);
        return response.data.data.user;
      }

      throw new Error('Failed to get profile');
    } catch (error) {
      console.error('Get profile failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      const response = await this.apiClient.put('/profile', updates);
      
      if (response.data.success) {
        this.storeUser(response.data.data.user);
        return response.data.data.user;
      }

      throw new Error('Failed to update profile');
    } catch (error) {
      console.error('Update profile failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.apiClient.post('/password/reset-request', { email });
    } catch (error) {
      console.error('Password reset request failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await this.apiClient.post('/password/reset', { token, newPassword });
    } catch (error) {
      console.error('Password reset failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      await this.apiClient.get(`/email/verify/${token}`);
    } catch (error) {
      console.error('Email verification failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(): Promise<void> {
    try {
      await this.apiClient.post('/email/resend-verification');
    } catch (error) {
      console.error('Resend verification failed:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Check if email is available
   */
  async checkEmailAvailability(email: string): Promise<boolean> {
    try {
      const response = await this.apiClient.get(`/email/check-availability?email=${encodeURIComponent(email)}`);
      return response.data.data.available;
    } catch (error) {
      console.error('Email availability check failed:', error);
      return false;
    }
  }

  // Token management methods

  /**
   * Get stored access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('stellarrec_access_token');
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('stellarrec_refresh_token');
  }

  /**
   * Store authentication tokens
   */
  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('stellarrec_access_token', tokens.accessToken);
    localStorage.setItem('stellarrec_refresh_token', tokens.refreshToken);
    localStorage.setItem('stellarrec_token_expires', (Date.now() + tokens.expiresIn * 1000).toString());
  }

  /**
   * Clear stored tokens
   */
  private clearTokens(): void {
    localStorage.removeItem('stellarrec_access_token');
    localStorage.removeItem('stellarrec_refresh_token');
    localStorage.removeItem('stellarrec_token_expires');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const expiresAt = localStorage.getItem('stellarrec_token_expires');
    
    if (!token || !expiresAt) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const isExpired = Date.now() > (parseInt(expiresAt) - 5 * 60 * 1000);
    
    if (isExpired) {
      // Try to refresh token silently
      this.refreshToken().catch(() => {
        this.clearTokens();
      });
    }

    return !isExpired;
  }

  // User management methods

  /**
   * Get stored user data
   */
  getCurrentUser(): User | null {
    const userData = localStorage.getItem('stellarrec_user');
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Store user data
   */
  private storeUser(user: User): void {
    localStorage.setItem('stellarrec_user', JSON.stringify(user));
  }

  /**
   * Clear stored user data
   */
  private clearUser(): void {
    localStorage.removeItem('stellarrec_user');
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  /**
   * Check if user's email is verified
   */
  isEmailVerified(): boolean {
    const user = this.getCurrentUser();
    return user?.emailVerified || false;
  }

  /**
   * Check if user's profile is complete
   */
  isProfileComplete(): boolean {
    const user = this.getCurrentUser();
    return user?.profileComplete || false;
  }

  // Error handling

  private handleAuthError(error: any): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error);
    }
    
    if (error.response?.status === 401) {
      return new Error('Invalid credentials');
    }
    
    if (error.response?.status === 403) {
      return new Error('Access denied');
    }
    
    if (error.response?.status === 429) {
      return new Error('Too many attempts. Please try again later.');
    }
    
    return new Error('Authentication failed. Please try again.');
  }
}

export default new AuthService();