import React from 'react';
import { motion } from 'framer-motion';

interface ScrollSectionsProps {
  theme: 'light' | 'dark';
}

export const ScrollSections: React.FC<ScrollSectionsProps> = ({ theme }) => {
  const sections = [
    {
      title: 'The Vision',
      subtitle: 'Urban traffic intelligence reimagined',
      description: 'ORION turns Mumbai traffic data into plain answers: which route, when to leave, and what it costs in time, fuel and CO₂.',
    },
    {
      title: 'Commercial Intelligence',
      subtitle: 'Fleet optimization at scale',
      description: 'Compare real route alternatives by travel time and fuel use, and pick the departure slot that keeps vehicles out of the worst traffic.',
    },
    {
      title: 'Private Navigation',
      subtitle: 'Your personal traffic advisor',
      description: 'See how long a trip takes at every hour of the day, find the fastest time to leave, and the best day within a date range.',
    },
    {
      title: 'Real Data Core',
      subtitle: 'Grounded in measurement',
      description: 'Travel times come from Mapbox live and typical traffic, and fuel from a published government speed–fuel curve. No invented numbers.',
    },
    {
      title: 'Mission Forward',
      subtitle: 'Building smarter cities',
      description: 'Join the transportation revolution. Welcome to the future of urban mobility.',
    },
  ];

  return (
    <div className="pointer-events-none">
      {sections.map((section, index) => (
        <div
          key={index}
          className="h-screen flex items-center justify-start px-8 md:px-16 lg:px-24"
        >
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.2, once: false }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="max-w-2xl"
          >
            <motion.p
              className={`text-sm md:text-base font-medium mb-4 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.2, once: false }}
              transition={{ duration: 0.4, delay: 0 }}
            >
              {section.subtitle}
            </motion.p>
            
            <motion.h2
              className={`text-5xl md:text-6xl lg:text-7xl font-bold mb-6 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.2, once: false }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              {section.title}
            </motion.h2>
            
            <motion.p
              className={`text-lg md:text-xl lg:text-2xl leading-relaxed ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.2, once: false }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {section.description}
            </motion.p>
          </motion.div>
        </div>
      ))}
    </div>
  );
};
