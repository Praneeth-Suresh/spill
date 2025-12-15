/**
 * Database seeding script for Spill application
 * Creates initial facilities, sample questions, and test data
 * Run with: tsx scripts/seed-db.ts
 */

import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../drizzle/schema';
import 'dotenv/config';

const db = drizzle(process.env.DATABASE_URL!);

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create facilities
    console.log('Creating facilities...');
    const [oasisFacility] = await db.insert(schema.facilities).values([
      {
        name: 'Oasis',
        code: 'OAS',
        description: 'Main recreation facility',
        isActive: true,
      },
    ]);

    const [tr1Facility] = await db.insert(schema.facilities).values([
      {
        name: 'TR1',
        code: 'TR1',
        description: 'Training Room 1',
        isActive: true,
      },
    ]);

    const [tr2Facility] = await db.insert(schema.facilities).values([
      {
        name: 'TR2',
        code: 'TR2',
        description: 'Training Room 2',
        isActive: true,
      },
    ]);

    const [mpshFacility] = await db.insert(schema.facilities).values([
      {
        name: 'MPSH',
        code: 'MPSH',
        description: 'Multi-Purpose Sports Hall',
        isActive: true,
      },
    ]);

    console.log('✅ Created 4 facilities');

    // Create home question (generic feedback page)
    console.log('Creating home question...');
    const [homeQuestion] = await db.insert(schema.questions).values([
      {
        facilityId: oasisFacility.insertId,
        type: 'text',
        title: 'Share your feedback',
        description: 'Tell us about your experience or report any issues',
        placeholder: 'Type your feedback here...',
        isRequired: false,
        redirectToHome: false, // This IS the home
        displayOrder: 0,
        isActive: true,
        pointsAwarded: 0,
      },
    ]);

    console.log('✅ Created home question');

    // Create sample poll question for Oasis (movie selection)
    console.log('Creating Oasis movie poll...');
    const [movieQuestion] = await db.insert(schema.questions).values([
      {
        facilityId: oasisFacility.insertId,
        type: 'poll',
        title: 'What movie do you want to watch?',
        description: 'Vote for the next movie screening at Oasis',
        isRequired: true,
        allowMultiple: false,
        redirectToHome: true,
        displayOrder: 1,
        isActive: true,
        pointsAwarded: 300,
      },
    ]);

    // Add movie options
    await db.insert(schema.questionOptions).values([
      {
        questionId: movieQuestion.insertId,
        optionText: 'Dune: Part One',
        displayOrder: 1,
        isActive: true,
      },
      {
        questionId: movieQuestion.insertId,
        optionText: 'Lord of the Rings',
        displayOrder: 2,
        isActive: true,
      },
      {
        questionId: movieQuestion.insertId,
        optionText: 'The Conjuring',
        displayOrder: 3,
        isActive: true,
      },
    ]);

    console.log('✅ Created Oasis movie poll with 3 options');

    // Create sample text question for MPSH (equipment damage report)
    console.log('Creating MPSH equipment report...');
    const [equipmentQuestion] = await db.insert(schema.questions).values([
      {
        facilityId: mpshFacility.insertId,
        type: 'text',
        title: 'Report any equipment damages',
        description: 'Help us maintain the facility by reporting damaged equipment',
        placeholder: 'Describe the damage and location...',
        isRequired: true,
        redirectToHome: true,
        displayOrder: 2,
        isActive: true,
        pointsAwarded: 200,
      },
    ]);

    console.log('✅ Created MPSH equipment report question');

    // Create sample poll for Oasis (activities)
    console.log('Creating Oasis activities poll...');
    const [activitiesQuestion] = await db.insert(schema.questions).values([
      {
        facilityId: oasisFacility.insertId,
        type: 'poll',
        title: 'What activities do you want?',
        description: 'Help us plan future activities',
        isRequired: true,
        allowMultiple: true, // Allow multiple selections
        redirectToHome: true,
        displayOrder: 3,
        isActive: true,
        pointsAwarded: 100,
      },
    ]);

    // Add activity options
    await db.insert(schema.questionOptions).values([
      {
        questionId: activitiesQuestion.insertId,
        optionText: 'Art & Crafts',
        displayOrder: 1,
        isActive: true,
      },
      {
        questionId: activitiesQuestion.insertId,
        optionText: 'Games',
        displayOrder: 2,
        isActive: true,
      },
      {
        questionId: activitiesQuestion.insertId,
        optionText: 'Movie Nights',
        displayOrder: 3,
        isActive: true,
      },
    ]);

    console.log('✅ Created Oasis activities poll with 3 options');

    // Seed updates feed entries
    console.log('Creating updates feed...');
    await db.insert(schema.updates).values([
      {
        date: new Date(),
        person: 'Operations',
        content: 'We\'re in contact with the vendor to repair the fridge. It\'ll be ready soon!\n\nThanks for reporting the issues!\n\nStay tuned for more updates.',
        relevance: 10,
      },
      {
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        person: 'Choon Heng',
        content: 'Update: we solved the light issue. It should be working well now.\n\nWe\'re looking into the complaints about the fridge. Stay tuned for any updates.\n\nCheers!',
        relevance: 9,
      },
      {
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        person: 'Facilities',
        content: 'Floor markings have been refreshed across the hall.\n\nNew cleaning schedule is in place to reduce dust.\n\nReport any issues via spill and we\'ll take a look.',
        relevance: 8,
      },
    ]);
    console.log('✅ Seeded updates feed');

    // Seed sample points for anonymous IPs (IPv4 mapped to IPv6)
    await db.insert(schema.points).values([
      { ipAddress: '::ffff:192.168.1.50', points: 900 },
      { ipAddress: '::ffff:192.168.1.75', points: 1200 },
    ]);

    // Create sample responses for testing analytics
    console.log('Creating sample responses...');
    
    // Movie poll responses
    for (let i = 0; i < 92; i++) {
      const response = await db.insert(schema.responses).values({
        questionId: movieQuestion.insertId,
        facilityId: oasisFacility.insertId,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
      });

      // Randomly select an option (1-3 for movie options)
      const optionId = Math.floor(Math.random() * 3) + 1;
      await db.insert(schema.responseAnswers).values({
        responseId: response[0].insertId,
        questionId: movieQuestion.insertId,
        optionId: optionId,
      });
    }

    // Equipment report responses
    for (let i = 0; i < 24; i++) {
      const response = await db.insert(schema.responses).values({
        questionId: equipmentQuestion.insertId,
        facilityId: mpshFacility.insertId,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });

      const reports = [
        'Broken bench in MPSH',
        'Common Lounge Printer Failure',
        'Lift 3 waiting time is too long',
        'Basketball hoop net is torn',
        'Treadmill not working properly',
      ];

      await db.insert(schema.responseAnswers).values({
        responseId: response[0].insertId,
        questionId: equipmentQuestion.insertId,
        textAnswer: reports[Math.floor(Math.random() * reports.length)],
      });
    }

    // Activities poll responses (options 4-6)
    for (let i = 0; i < 37; i++) {
      const response = await db.insert(schema.responses).values({
        questionId: activitiesQuestion.insertId,
        facilityId: oasisFacility.insertId,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });

      // Randomly select 1-2 options (4-6 for activity options)
      const numSelections = Math.random() > 0.5 ? 1 : 2;
      const selectedOptions: number[] = [];
      
      while (selectedOptions.length < numSelections) {
        const optionId = Math.floor(Math.random() * 3) + 4; // Options 4, 5, 6
        if (!selectedOptions.includes(optionId)) {
          selectedOptions.push(optionId);
          await db.insert(schema.responseAnswers).values({
            responseId: response[0].insertId,
            questionId: activitiesQuestion.insertId,
            optionId: optionId,
          });
        }
      }
    }

    console.log('✅ Created sample responses (92 movie votes, 24 equipment reports, 37 activity votes)');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\nSummary:');
    console.log('- 4 facilities (Oasis, TR1, TR2, MPSH)');
    console.log('- 1 home question (generic feedback)');
    console.log('- 2 poll questions (movie, activities)');
    console.log('- 1 text question (equipment report)');
    console.log('- 153 total sample responses');
    console.log('- 3 updates entries');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log('✅ Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
