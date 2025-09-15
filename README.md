 # StellarRec
[Live Demo](https://stellarrec.netlify.app/)

StellarRec is a revolutionary AI-powered platform that streamlines the university recommendation letter process. Instead of writing multiple letters for different universities, recommenders can upload one high-quality letter and seamlessly distribute it to multiple institutions, saving hours of work while boosting student application success rates.

---

## 📌 The Problem We Solve

- **Time-consuming repetition**: Recommenders traditionally write separate letters for each university  
- **Inconsistent quality**: Multiple letters may vary in quality and content  
- **Administrative burden**: Complex submission processes across different university portals  
- **Limited reach**: Students often limit applications due to recommendation letter bottlenecks  

---

## 🚀 Our Solution

StellarRec transforms recommendation letters from a manual, repetitive process into an intelligent, scalable system that benefits all stakeholders in the university application ecosystem.

StellarRec is a productivity and workflow tool designed to save time, reduce friction, and simplify the college application experience. With AI-powered support, student recommendations become streamlined and smart—allowing recommenders to manage letters for multiple universities and applicants without redundancy. By centralizing the process, StellarRec not only saves valuable time for students and mentors but also reduces stress, improves acceptance rates, and makes the entire application journey more accessible and transparent.

---

## 🎓 For Students

- **Simplified Requests**: Easy interface to request recommendations from multiple recommenders  
- **Application Tracking**: Monitor recommendation status across all university applications  
- **Deadline Management**: Automated reminders and deadline tracking  
- **University Integration**: Seamless submission to university admissions systems  

<img width="742" height="388" alt="image" src="https://github.com/user-attachments/assets/3ecea2ad-480f-4701-b8de-79ef2a47e9be" />

---

## 👨‍🏫 For Recommenders

- **Single Upload**: Write one comprehensive letter, send to unlimited universities  
- **AI Enhancement**: Intelligent content optimization for different institutions  
- **Batch Processing**: Submit recommendations to multiple universities simultaneously  
- **Status Tracking**: Real-time visibility into submission status across all applications  
- **Template Library**: Access to professionally crafted recommendation templates  

<img width="335" height="430" alt="image" src="https://github.com/user-attachments/assets/fbd7c5bd-c392-4745-9d3f-6ccfe0e20f49" />

---

## 🏛️ For Universities

- **API Integration**: Modern REST APIs for seamless integration with existing systems  
- **Real-time Updates**: Instant notification when recommendations are submitted  
- **Standardized Format**: Consistent recommendation letter formatting and metadata  
- **Fraud Prevention**: Built-in verification and authentication mechanisms  
- **Future-Ready**: Support for **video recommendations**, enabling a richer and more authentic perspective from recommenders  

<img width="647" height="416" alt="image" src="https://github.com/user-attachments/assets/d5f071bf-64d9-4c52-ac27-31e1ba4d1e74" />

---

## 🛠️ Architecture Overview

StellarRec follows a modern full-stack architecture with clear separation between frontend and backend components.

### **Frontend (Client-Side)**
- **Framework**: React.js with functional components and hooks  
- **Styling**: CSS3 with responsive design principles  
- **State Management**: React Context API and useState hooks  
- **Routing**: React Router for single-page application navigation  
- **Build Tool**: Create React App with Webpack configuration  

### **Backend (Server-Side)**
- **Runtime**: Node.js with Express.js framework  
- **Authentication**: JWT (JSON Web Tokens) for secure API access  
- **Database**: MongoDB with Mongoose ODM for data persistence  
- **File Storage**: Secure cloud storage for recommendation documents  
- **API Design**: RESTful architecture with JSON payloads  

### **Data Flow**
1. **Student creates request**: Student fills out requester form, providing university details  
2. **Recommender receives email**: System sends email notification with secure link  
3. **Recommender writes letter**: Authenticated user accesses portal to compose recommendation  
4. **Submission processing**: Letter is encrypted, stored, and distributed to specified universities  
5. **University integration**: Target institutions receive via webhook or API call  
6. **Status updates**: All parties receive notifications throughout the process  

---

## ⚙️ Key Technologies

- **Frontend**: React, TypeScript, Tailwind CSS  
- **Backend**: Node.js, Express, MongoDB  
- **AI/ML**: Natural Language Processing for letter optimization  
- **APIs**: RESTful services with OpenAPI documentation  
- **Security**: OAuth 2.0, JWT authentication, encryption  
- **Deployment**: Netlify (frontend), cloud hosting (backend)  

---

## 🔗 Integration with Mock University

**[Demo Link](https://mockuniversity.netlify.app/apply.html?external_id=sr_1757781570892)**  

### Purpose  
The **Mock University** repository serves as a demonstration environment showcasing how real universities can integrate with StellarRec through modern APIs.  

### API Endpoints  

**StellarRec → Mock University**  
- `POST /api/recommendations` – Submit a new recommendation request  
- `PUT /api/recommendations/:id` – Update recommendation status  
- `GET /api/recommendations/:studentId` – Retrieve student recommendations  

### Authentication Flow  
- StellarRec authenticates with Mock University API using **OAuth 2.0**  
- Secure API keys exchanged for authenticated requests  
- **JWT tokens** used for session management  
- Role-based access control: *student, recommender, admin*  

---

## 📖 Usage Guide

### ✅ For Students
1. Create an account on StellarRec  
2. Add recommenders to your network  
3. Request recommendations by filling out the request form:  
   - Select program details  
   - Add university information  
   - Set submission deadlines  
   - Add personal statement or resume  
4. Track status of each recommendation request  
5. Resend reminders to recommenders if needed  

---

### ✅ For Recommenders
1. Receive email invitation from a student  
2. Create an account or log in to an existing account  
3. View pending requests in your dashboard  
4. Write recommendation using the structured form:  
   - Rate student on various competencies  
   - Add free-form evaluation  
   - Upload supporting documents if needed  
5. Submit to specified universities with one click  
6. Manage previous recommendations for future use  

---

### ✅ For Universities
1. Integrate with StellarRec by providing API endpoints  
2. Receive recommendations in standardized format  
3. Verify authenticity using digital signatures  
4. Access recommendation portal to view and manage submissions  
5. Sync with application systems through webhooks or APIs  
