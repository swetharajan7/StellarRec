import { Request, Response } from 'express';
export declare class AIIntelligenceController {
    private aiService;
    private predictiveEngine;
    private contentOptimizer;
    private logger;
    constructor();
    generateUniversityRecommendations(req: Request, res: Response): Promise<void>;
    optimizeContent(req: Request, res: Response): Promise<void>;
    createIntelligentWorkflow(req: Request, res: Response): Promise<void>;
    predictAdmissionSuccess(req: Request, res: Response): Promise<void>;
    getRealTimeInsights(req: Request, res: Response): Promise<void>;
    analyzePortfolio(req: Request, res: Response): Promise<void>;
    analyzeScholarships(req: Request, res: Response): Promise<void>;
    getWorkflow(req: Request, res: Response): Promise<void>;
    updateTaskStatus(req: Request, res: Response): Promise<void>;
    analyzeContent(req: Request, res: Response): Promise<void>;
    optimizeTiming(req: Request, res: Response): Promise<void>;
    private getStudentProfile;
    private getWorkflowById;
    private updateWorkflowTaskStatus;
    private calculateWorkflowProgress;
    private calculateOverallContentScore;
}
//# sourceMappingURL=aiIntelligenceController.d.ts.map