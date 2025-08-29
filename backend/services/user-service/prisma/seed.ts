import { PrismaClient, UserRole, ApplicationStatus, LetterStatus, MatchCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const adminUser = await prisma.users.create({
    data: {
      email: 'admin@stellarrec.com',
      password_hash: hashedPassword,
      role: UserRole.admin,
      email_verified: true,
      is_active: true,
    },
  });

  // Create student users
  const student1 = await prisma.users.create({
    data: {
      email: 'john.doe@student.com',
      password_hash: hashedPassword,
      role: UserRole.student,
      email_verified: true,
      is_active: true,
      student_profiles: {
        create: {
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: new Date('2002-05-15'),
          phone: '+1-555-0123',
          address: {
            street: '123 Main St',
            city: 'Boston',
            state: 'MA',
            zipCode: '02101',
            country: 'USA'
          },
          gpa: 3.85,
          graduation_year: 2024,
          academic_interests: ['Computer Science', 'Mathematics', 'Physics'],
          target_programs: ['Computer Science', 'Software Engineering', 'Data Science'],
          test_scores: {
            SAT: { total: 1520, math: 780, verbal: 740 },
            GRE: { total: 325, quantitative: 165, verbal: 160, writing: 4.5 }
          },
          profile_data: {
            extracurriculars: ['Programming Club', 'Math Olympiad', 'Volunteer Tutor'],
            awards: ['Dean\'s List', 'Outstanding Student in CS'],
            workExperience: ['Software Intern at TechCorp']
          }
        }
      },
      user_preferences: {
        create: {
          notifications: {
            email: true,
            sms: false,
            push: true,
            deadlineReminders: true,
            applicationUpdates: true
          },
          privacy: {
            profileVisibility: 'private',
            dataSharing: false,
            analyticsOptIn: true
          },
          language: 'en',
          timezone: 'America/New_York',
          theme: 'light'
        }
      }
    },
  });

  const student2 = await prisma.users.create({
    data: {
      email: 'jane.smith@student.com',
      password_hash: hashedPassword,
      role: UserRole.student,
      email_verified: true,
      is_active: true,
      student_profiles: {
        create: {
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: new Date('2001-08-22'),
          phone: '+1-555-0124',
          address: {
            street: '456 Oak Ave',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94102',
            country: 'USA'
          },
          gpa: 3.92,
          graduation_year: 2024,
          academic_interests: ['Biology', 'Chemistry', 'Medicine'],
          target_programs: ['Pre-Med', 'Biomedical Engineering', 'Biochemistry'],
          test_scores: {
            SAT: { total: 1580, math: 800, verbal: 780 },
            MCAT: { total: 520, sections: { cp: 130, cars: 129, bb: 131, ps: 130 } }
          },
          profile_data: {
            extracurriculars: ['Pre-Med Society', 'Research Assistant', 'Hospital Volunteer'],
            awards: ['Summa Cum Laude', 'Research Excellence Award'],
            workExperience: ['Lab Research Assistant', 'Medical Scribe']
          }
        }
      },
      user_preferences: {
        create: {
          notifications: {
            email: true,
            sms: true,
            push: true,
            deadlineReminders: true,
            applicationUpdates: true
          },
          privacy: {
            profileVisibility: 'public',
            dataSharing: true,
            analyticsOptIn: true
          },
          language: 'en',
          timezone: 'America/Los_Angeles',
          theme: 'dark'
        }
      }
    },
  });

  // Create recommender users
  const recommender1 = await prisma.users.create({
    data: {
      email: 'prof.johnson@university.edu',
      password_hash: hashedPassword,
      role: UserRole.recommender,
      email_verified: true,
      is_active: true,
      recommender_profiles: {
        create: {
          first_name: 'Dr. Michael',
          last_name: 'Johnson',
          title: 'Professor of Computer Science',
          institution: 'MIT',
          department: 'Computer Science and Artificial Intelligence Laboratory',
          phone: '+1-617-555-0100',
          office_address: '32 Vassar St, Cambridge, MA 02139',
          expertise_areas: ['Machine Learning', 'Artificial Intelligence', 'Data Science', 'Algorithms'],
          years_experience: 15,
          profile_data: {
            education: ['PhD Computer Science - Stanford', 'MS Computer Science - CMU'],
            publications: 85,
            researchInterests: ['Deep Learning', 'Natural Language Processing', 'Computer Vision'],
            courses: ['Introduction to AI', 'Machine Learning', 'Advanced Algorithms']
          }
        }
      },
      user_preferences: {
        create: {
          notifications: {
            email: true,
            sms: false,
            push: false,
            letterRequests: true,
            deadlineReminders: true
          },
          privacy: {
            profileVisibility: 'public',
            dataSharing: false,
            analyticsOptIn: false
          },
          language: 'en',
          timezone: 'America/New_York',
          theme: 'light'
        }
      }
    },
  });

  const recommender2 = await prisma.users.create({
    data: {
      email: 'dr.williams@medschool.edu',
      password_hash: hashedPassword,
      role: UserRole.recommender,
      email_verified: true,
      is_active: true,
      recommender_profiles: {
        create: {
          first_name: 'Dr. Sarah',
          last_name: 'Williams',
          title: 'Associate Professor of Biology',
          institution: 'Harvard Medical School',
          department: 'Department of Cell Biology',
          phone: '+1-617-555-0200',
          office_address: '25 Shattuck St, Boston, MA 02115',
          expertise_areas: ['Cell Biology', 'Molecular Biology', 'Genetics', 'Biochemistry'],
          years_experience: 12,
          profile_data: {
            education: ['PhD Biology - Harvard', 'MD - Johns Hopkins'],
            publications: 62,
            researchInterests: ['Cancer Biology', 'Stem Cell Research', 'Gene Therapy'],
            courses: ['Cell Biology', 'Molecular Biology', 'Advanced Genetics']
          }
        }
      },
      user_preferences: {
        create: {
          notifications: {
            email: true,
            sms: true,
            push: true,
            letterRequests: true,
            deadlineReminders: true
          },
          privacy: {
            profileVisibility: 'public',
            dataSharing: true,
            analyticsOptIn: true
          },
          language: 'en',
          timezone: 'America/New_York',
          theme: 'light'
        }
      }
    },
  });

  // Create universities
  const mit = await prisma.universities.create({
    data: {
      name: 'Massachusetts Institute of Technology',
      short_name: 'MIT',
      location: {
        city: 'Cambridge',
        state: 'Massachusetts',
        country: 'USA',
        coordinates: { lat: 42.3601, lng: -71.0942 }
      },
      ranking: {
        overall: 1,
        engineering: 1,
        computerScience: 1,
        business: 5
      },
      admission_requirements: {
        minGPA: 3.7,
        testScores: {
          SAT: { min: 1500, max: 1600 },
          GRE: { min: 320, max: 340 }
        },
        essays: [
          { prompt: 'Describe your academic and career goals', wordLimit: 500 },
          { prompt: 'Tell us about a challenge you overcame', wordLimit: 300 }
        ],
        recommendations: 3
      },
      deadlines: {
        earlyAction: '2024-11-01T23:59:59Z',
        regularDecision: '2024-01-01T23:59:59Z',
        financialAid: '2024-02-15T23:59:59Z'
      },
      integration_config: {
        apiEndpoint: 'https://api.mit.edu/admissions',
        authMethod: 'oauth2',
        supportedFormats: ['json', 'xml']
      },
      metadata: {
        website: 'https://web.mit.edu',
        tuition: 57986,
        acceptance_rate: 0.04,
        student_count: 11934
      },
      is_active: true
    },
  });

  const harvard = await prisma.universities.create({
    data: {
      name: 'Harvard University',
      short_name: 'Harvard',
      location: {
        city: 'Cambridge',
        state: 'Massachusetts',
        country: 'USA',
        coordinates: { lat: 42.3770, lng: -71.1167 }
      },
      ranking: {
        overall: 2,
        medicine: 1,
        law: 3,
        business: 1
      },
      admission_requirements: {
        minGPA: 3.8,
        testScores: {
          SAT: { min: 1520, max: 1600 },
          MCAT: { min: 515, max: 528 }
        },
        essays: [
          { prompt: 'What would you want your future college roommate to know about you?', wordLimit: 400 },
          { prompt: 'How do you hope to use your college education?', wordLimit: 400 }
        ],
        recommendations: 2
      },
      deadlines: {
        earlyAction: '2024-11-01T23:59:59Z',
        regularDecision: '2024-01-01T23:59:59Z',
        financialAid: '2024-02-01T23:59:59Z'
      },
      integration_config: {
        apiEndpoint: 'https://api.harvard.edu/admissions',
        authMethod: 'api_key',
        supportedFormats: ['json']
      },
      metadata: {
        website: 'https://www.harvard.edu',
        tuition: 59076,
        acceptance_rate: 0.03,
        student_count: 23731
      },
      is_active: true
    },
  });

  // Create programs
  const mitCS = await prisma.programs.create({
    data: {
      university_id: mit.id,
      name: 'Computer Science',
      degree: 'Bachelor of Science',
      department: 'Electrical Engineering and Computer Science',
      description: 'A comprehensive program covering algorithms, systems, theory, and applications of computing.',
      requirements: {
        prerequisites: ['Calculus I & II', 'Physics I', 'Chemistry'],
        coreClasses: ['Introduction to Algorithms', 'Computer Systems', 'Software Engineering'],
        credits: 180,
        gpaRequirement: 3.5
      },
      duration: '4 years',
      tuition: {
        inState: 57986,
        outOfState: 57986,
        international: 57986
      },
      is_active: true
    },
  });

  const harvardBio = await prisma.programs.create({
    data: {
      university_id: harvard.id,
      name: 'Molecular and Cellular Biology',
      degree: 'Bachelor of Arts',
      department: 'Department of Molecular and Cellular Biology',
      description: 'Study of biological processes at the molecular and cellular level.',
      requirements: {
        prerequisites: ['Biology', 'Chemistry', 'Physics', 'Calculus'],
        coreClasses: ['Cell Biology', 'Genetics', 'Biochemistry', 'Molecular Biology'],
        credits: 128,
        gpaRequirement: 3.7
      },
      duration: '4 years',
      tuition: {
        inState: 59076,
        outOfState: 59076,
        international: 59076
      },
      is_active: true
    },
  });

  // Create applications
  const application1 = await prisma.applications.create({
    data: {
      student_id: student1.id,
      university_id: mit.id,
      program_id: mitCS.id,
      status: ApplicationStatus.in_progress,
      progress_percentage: 65,
      deadline: new Date('2024-01-01T23:59:59Z'),
      notes: 'Strong candidate with excellent programming skills',
      application_components: {
        create: [
          {
            component_type: 'personal_info',
            status: 'completed',
            data: {
              personalStatement: 'I am passionate about computer science...',
              activities: ['Programming Club President', 'Hackathon Winner']
            },
            completed_at: new Date('2023-10-15T10:00:00Z')
          },
          {
            component_type: 'academic_history',
            status: 'completed',
            data: {
              transcripts: 'uploaded',
              gpa: 3.85,
              coursework: ['Data Structures', 'Algorithms', 'Machine Learning']
            },
            completed_at: new Date('2023-10-20T14:30:00Z')
          },
          {
            component_type: 'test_scores',
            status: 'completed',
            data: {
              SAT: { total: 1520, math: 780, verbal: 740 },
              GRE: { total: 325, quantitative: 165, verbal: 160 }
            },
            completed_at: new Date('2023-10-25T09:15:00Z')
          },
          {
            component_type: 'essays',
            status: 'in_progress',
            data: {
              essay1: { prompt: 'Academic goals', draft: 'My academic goals include...', wordCount: 245 },
              essay2: { prompt: 'Challenge overcome', draft: '', wordCount: 0 }
            }
          },
          {
            component_type: 'recommendations',
            status: 'pending',
            data: {
              requested: 3,
              received: 1,
              recommenders: [
                { name: 'Dr. Michael Johnson', status: 'submitted' },
                { name: 'Prof. Lisa Chen', status: 'pending' },
                { name: 'Dr. Robert Kim', status: 'pending' }
              ]
            }
          }
        ]
      },
      timeline_events: {
        create: [
          {
            event_type: 'deadline',
            title: 'Application Deadline',
            description: 'Final deadline for MIT Computer Science application',
            due_date: new Date('2024-01-01T23:59:59Z'),
            priority: 'critical',
            status: 'pending'
          },
          {
            event_type: 'task',
            title: 'Complete Essays',
            description: 'Finish writing both required essays',
            due_date: new Date('2023-12-15T23:59:59Z'),
            priority: 'high',
            status: 'pending'
          },
          {
            event_type: 'task',
            title: 'Follow up on Recommendations',
            description: 'Contact remaining recommenders',
            due_date: new Date('2023-12-01T23:59:59Z'),
            priority: 'medium',
            status: 'pending'
          }
        ]
      }
    },
  });

  // Create recommendation letters
  const letter1 = await prisma.recommendation_letters.create({
    data: {
      student_id: student1.id,
      recommender_id: recommender1.id,
      title: 'Recommendation for John Doe - MIT Computer Science',
      content: `I am writing to provide my strongest recommendation for John Doe's application to MIT's Computer Science program. 
      
As John's professor for Advanced Algorithms and Machine Learning courses, I have had the opportunity to observe his exceptional analytical abilities and passion for computer science. John consistently demonstrated mastery of complex concepts and showed remarkable creativity in problem-solving.

His final project on neural network optimization was among the best I've seen in my 15 years of teaching. John's work ethic, intellectual curiosity, and collaborative spirit make him an ideal candidate for MIT's rigorous program.

I recommend John without reservation and believe he will make significant contributions to your program.`,
      status: LetterStatus.approved,
      ai_suggestions: [
        {
          type: 'strength',
          suggestion: 'Consider adding specific examples of the student\'s achievements',
          confidence: 0.85
        },
        {
          type: 'structure',
          suggestion: 'The conclusion could be strengthened with future potential',
          confidence: 0.78
        }
      ],
      letter_deliveries: {
        create: [
          {
            university_id: mit.id,
            delivery_method: 'api',
            status: 'delivered',
            delivered_at: new Date('2023-11-15T10:30:00Z'),
            confirmation_id: 'MIT-2024-REC-001234'
          }
        ]
      },
      letter_versions: {
        create: [
          {
            version: 1,
            content: 'Initial draft of the recommendation letter...',
            changes: 'Initial version',
            created_by: recommender1.id
          },
          {
            version: 2,
            content: 'Revised version with additional examples...',
            changes: 'Added specific project examples and strengthened conclusion',
            created_by: recommender1.id
          }
        ]
      }
    },
  });

  // Create university matches
  await prisma.university_matches.create({
    data: {
      student_id: student1.id,
      university_id: mit.id,
      match_percentage: 92.5,
      confidence: 88.3,
      category: MatchCategory.target,
      reasoning: {
        academic_fit: 'Excellent GPA and test scores align with MIT standards',
        program_alignment: 'Strong background in CS with relevant coursework',
        research_interests: 'AI/ML interests match faculty expertise',
        location_preference: 'Prefers East Coast universities'
      },
      factors: [
        { factor: 'GPA', score: 95, weight: 0.3 },
        { factor: 'Test Scores', score: 90, weight: 0.25 },
        { factor: 'Extracurriculars', score: 88, weight: 0.2 },
        { factor: 'Research Experience', score: 85, weight: 0.15 },
        { factor: 'Location Fit', score: 100, weight: 0.1 }
      ]
    },
  });

  await prisma.university_matches.create({
    data: {
      student_id: student2.id,
      university_id: harvard.id,
      match_percentage: 89.7,
      confidence: 91.2,
      category: MatchCategory.target,
      reasoning: {
        academic_fit: 'Outstanding academic record exceeds Harvard requirements',
        program_alignment: 'Pre-med track with strong biology background',
        research_interests: 'Cell biology research aligns with faculty',
        extracurriculars: 'Medical volunteering demonstrates commitment'
      },
      factors: [
        { factor: 'GPA', score: 98, weight: 0.35 },
        { factor: 'MCAT Score', score: 92, weight: 0.3 },
        { factor: 'Research Experience', score: 85, weight: 0.2 },
        { factor: 'Medical Experience', score: 90, weight: 0.15 }
      ]
    },
  });

  // Create essay analyses
  await prisma.essay_analyses.create({
    data: {
      user_id: student1.id,
      content: `My passion for computer science began when I was twelve years old and wrote my first program. 
      What started as curiosity about how video games worked evolved into a deep fascination with algorithms, 
      artificial intelligence, and the potential of technology to solve real-world problems.
      
      Throughout my undergraduate studies, I have consistently sought opportunities to apply theoretical 
      knowledge to practical challenges. My work on optimizing neural network architectures resulted in 
      a 15% improvement in processing speed while maintaining accuracy. This project taught me the importance 
      of balancing theoretical understanding with practical implementation.`,
      scores: {
        clarity: 85,
        impact: 78,
        originality: 82,
        grammar: 92,
        structure: 88,
        overall: 85
      },
      suggestions: [
        {
          type: 'content',
          text: 'Consider adding more specific examples of leadership or teamwork',
          position: { start: 245, end: 280 },
          confidence: 0.82
        },
        {
          type: 'structure',
          text: 'The conclusion could be strengthened with future goals',
          position: { start: 580, end: 620 },
          confidence: 0.75
        }
      ],
      word_count: 156,
      readability_score: 78.5,
      sentiment: 'positive',
      key_topics: ['computer science', 'artificial intelligence', 'neural networks', 'optimization', 'problem solving']
    },
  });

  // Create notifications
  await prisma.notifications.create({
    data: {
      user_id: student1.id,
      type: 'deadline_reminder',
      title: 'Application Deadline Approaching',
      message: 'Your MIT Computer Science application is due in 30 days. Complete your essays and follow up on recommendations.',
      data: {
        application_id: application1.id,
        days_remaining: 30,
        incomplete_components: ['essays', 'recommendations']
      },
      sent_at: new Date(),
      delivery_method: 'email'
    },
  });

  await prisma.notifications.create({
    data: {
      user_id: student1.id,
      type: 'letter_received',
      title: 'Recommendation Letter Submitted',
      message: 'Dr. Michael Johnson has submitted your recommendation letter for MIT.',
      data: {
        letter_id: letter1.id,
        recommender_name: 'Dr. Michael Johnson',
        university_name: 'MIT'
      },
      read: false,
      sent_at: new Date(),
      delivery_method: 'push'
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`Created:
  - ${await prisma.users.count()} users
  - ${await prisma.universities.count()} universities  
  - ${await prisma.programs.count()} programs
  - ${await prisma.applications.count()} applications
  - ${await prisma.recommendation_letters.count()} recommendation letters
  - ${await prisma.university_matches.count()} university matches
  - ${await prisma.notifications.count()} notifications`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });