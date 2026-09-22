const textExtractor = require('../services/textExtractor');

function sampleItems() {
  const rows = [
    {
      type: 'Found', title: 'Student ID Card (B.Tech First Year)', category: 'ID Card',
      location: 'Canteen', date: '2026-09-08', contact: 'canteen_desk@campus.edu',
      desc: 'Found near counter 2. Name on card reads Rishabh. Submitted to canteen counter.',
      status: 'Found', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=60'
    },
    {
      type: 'Lost', title: 'boAt Airdopes 141 (Black Case)', category: 'Electronics',
      location: 'Library', date: '2026-09-07', contact: 'rudraksh.m@campus.edu',
      desc: 'Black wireless earbuds lost in 2nd floor silent reading section around 2 PM.',
      status: 'Lost', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=60'
    },
    {
      type: 'Found', title: 'Engineering Chemistry Textbook', category: 'Books',
      location: 'Block A', date: '2026-09-09', contact: 'block_a_guard@campus.edu',
      desc: 'Standard textbook found on bench near Room A-102. Has handwritten notes inside.',
      status: 'Found', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&auto=format&fit=crop&q=60'
    },
    {
      type: 'Lost', title: 'Honda Bike Key with Keychain', category: 'Keys',
      location: 'Sports Complex', date: '2026-09-06', contact: 'rakshit.n@campus.edu',
      desc: 'Single bike key attached to a red leather keychain lost near basketball court.',
      status: 'Lost', image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=400&auto=format&fit=crop&q=60'
    },
    {
      type: 'Found', title: 'Brown Leather Wallet', category: 'Wallet',
      location: 'Hostel', date: '2026-09-08', contact: 'hostel_warden@campus.edu',
      desc: 'Wildhorn brown wallet found near Hostel 2 entry mess hall. Deposited with warden.',
      status: 'Found', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&auto=format&fit=crop&q=60'
    },
    {
      type: 'Lost', title: 'Casio Scientific Calculator FX-991EX', category: 'Electronics',
      location: 'Block A', date: '2026-09-09', contact: 'student_math@campus.edu',
      desc: 'Black scientific calculator misplaced in Mathematics lab. Has a small blue sticker on back.',
      status: 'Lost', image: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=400&auto=format&fit=crop&q=60'
    }
  ];
  return rows.map(r => ({
    ...r,
    detected: { available: false, labels: [] },
    embedding: { available: false, vector: [] },
    ai: { processed: true, extracted: textExtractor.extract(`${r.title} ${r.desc}`) }
  }));
}

module.exports = { sampleItems };