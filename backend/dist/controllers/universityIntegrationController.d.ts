import { Request, Response } from 'express';
export declare class UniversityIntegrationController {
    private logger;
    private integrationHub;
    private registry;
    private tracker;
    private rateLimiter;
    private authManager;
    constructor();
    submitToUniversities(req: Request, res: Response): Promise<void>;
    getSubmissionStatus(req: Request, res: Response): Promise<void>;
    retryFailedSubmissions(req: Request, res: Response): Promise<void>;
    getIntegrationStatistics(req: Request, res: Response): Promise<void>;
    testUniversityConnection(req: Request, res: Response): Promise<void>;
    searchUniversities(req: Request, res: Response): Promise<void>;
    getUniversitiesByIntegrationType(req: Request, res: Response): Promise<void>;
    getUniversitiesByLocation(req: Request, res: Response): Promise<void>;
    updateUniversityIntegration(req: Request, res: Response): Promise<void>;
    getSubmissionStatistics(req: Request, res: Response): Promise<void>;
    getRateLimitStatus(req: Request, res: Response): Promise<void>;
    resetRateLimits(req: Request, res: Response): Promise<void>;
    validateCredentials(req: Request, res: Response): Promise<void>;
    storeCredentials(req: Request, res: Response): Promise<void>;
    getIntegrationHealth(req: Request, res: Response): Promise<void>;
    bulkLoadUniversities(req: Request, res: Response): Promise<void>;
    getCredentialsNeedingRotation(req: Request, res: Response): Promise<void>;
    rotateCredentials(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=universityIntegrationController.d.ts.map