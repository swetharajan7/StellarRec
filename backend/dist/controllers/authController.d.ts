import { Request, Response } from 'express';
export declare class AuthController {
    private authService;
    private logger;
    constructor();
    register(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    refreshToken(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    requestPasswordReset(req: Request, res: Response): Promise<void>;
    resetPassword(req: Request, res: Response): Promise<void>;
    verifyEmail(req: Request, res: Response): Promise<void>;
    getProfile(req: Request, res: Response): Promise<void>;
    updateProfile(req: Request, res: Response): Promise<void>;
    checkEmailAvailability(req: Request, res: Response): Promise<void>;
    resendEmailVerification(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map