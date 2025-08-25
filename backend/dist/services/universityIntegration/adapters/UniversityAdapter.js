"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityAdapter = void 0;
class UniversityAdapter {
    constructor(authManager, rateLimiter) {
        this.authManager = authManager;
        this.rateLimiter = rateLimiter;
    }
    validateSubmissionData(data) {
        const errors = [];
        if (!data.student.firstName?.trim())
            errors.push('Student first name is required');
        if (!data.student.lastName?.trim())
            errors.push('Student last name is required');
        if (!data.student.email?.trim())
            errors.push('Student email is required');
        if (!this.isValidEmail(data.student.email))
            errors.push('Student email is invalid');
        if (!data.recommender.firstName?.trim())
            errors.push('Recommender first name is required');
        if (!data.recommender.lastName?.trim())
            errors.push('Recommender last name is required');
        if (!data.recommender.email?.trim())
            errors.push('Recommender email is required');
        if (!this.isValidEmail(data.recommender.email))
            errors.push('Recommender email is invalid');
        if (!data.recommender.institution?.trim())
            errors.push('Recommender institution is required');
        if (!data.recommendation.content?.trim())
            errors.push('Recommendation content is required');
        if (data.recommendation.wordCount < 50)
            errors.push('Recommendation content too short (minimum 50 words)');
        if (data.recommendation.wordCount > 10000)
            errors.push('Recommendation content too long (maximum 10000 words)');
        if (!data.university.universityCode?.trim())
            errors.push('University code is required');
        if (!data.university.programType?.trim())
            errors.push('Program type is required');
        if (!data.university.applicationDeadline)
            errors.push('Application deadline is required');
        if (data.university.applicationDeadline < new Date())
            errors.push('Application deadline has passed');
        return {
            valid: errors.length === 0,
            errors
        };
    }
    formatContentForUniversity(content, requirements) {
        let formattedContent = content;
        if (requirements.maxWordCount) {
            const words = content.split(/\s+/);
            if (words.length > requirements.maxWordCount) {
                formattedContent = words.slice(0, requirements.maxWordCount).join(' ') + '...';
            }
        }
        if (requirements.maxCharacters && formattedContent.length > requirements.maxCharacters) {
            formattedContent = formattedContent.substring(0, requirements.maxCharacters - 3) + '...';
        }
        if (requirements.plainTextOnly) {
            formattedContent = formattedContent.replace(/<[^>]*>/g, '');
            formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '$1');
            formattedContent = formattedContent.replace(/\*(.*?)\*/g, '$1');
        }
        return formattedContent;
    }
    calculateRetryDelay(attemptNumber) {
        const baseDelay = 1000;
        const maxDelay = 300000;
        const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
        const jitter = Math.random() * 0.1 * delay;
        return delay + jitter;
    }
    sanitizeForLogging(data) {
        const sanitized = JSON.parse(JSON.stringify(data));
        const sensitiveFields = ['password', 'apiKey', 'token', 'ssn', 'dateOfBirth'];
        const removeSensitiveData = (obj) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const key in obj) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                    obj[key] = '[REDACTED]';
                }
                else if (typeof obj[key] === 'object') {
                    removeSensitiveData(obj[key]);
                }
            }
        };
        removeSensitiveData(sanitized);
        return sanitized;
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}
exports.UniversityAdapter = UniversityAdapter;
//# sourceMappingURL=UniversityAdapter.js.map