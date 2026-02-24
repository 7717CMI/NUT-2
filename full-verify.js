const fs = require('fs');

// CSV parser that handles quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNum(val) {
  if (!val || val === '') return 0;
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

const years = ['2021','2022','2023','2024','2025','2026','2027','2028','2029','2030','2031','2032','2033'];

const regionCountries = {
  'North America': ['U.S.', 'Canada'],
  'Europe': ['U.K.', 'Germany', 'Italy', 'France', 'Spain', 'Turkey', 'Rest of Europe'],
  'Asia Pacific': ['China', 'India', 'Japan', 'South Korea', 'ASEAN', 'Australia', 'Rest of Asia Pacific'],
  'Latin America': ['Brazil', 'Argentina', 'Mexico', 'Rest of Latin America'],
  'Middle East & Africa': ['GCC', 'South Africa', 'Rest of Middle East & Africa']
};

const allCountries = Object.values(regionCountries).flat();
const regions = Object.keys(regionCountries);

function verifyCSVvsJSON(csvFile, jsonFile, dataType) {
  const csv = fs.readFileSync(csvFile, 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  const json = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  let totalChecks = 0;
  let mismatches = 0;
  let missing = 0;
  let countryMatchErrors = [];
  let regionSumErrors = [];
  let globalSumErrors = [];

  // Parse all CSV rows
  const csvRows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 17) continue;
    csvRows.push({
      region: fields[0],
      segment: fields[1],
      subsegment: fields[2],
      subsegment1: fields[3],
      years: {}
    });
    for (let y = 0; y < years.length; y++) {
      csvRows[csvRows.length - 1].years[years[y]] = parseNum(fields[4 + y]);
    }
  }

  console.log(`\n========== ${dataType.toUpperCase()} VERIFICATION ==========`);
  console.log(`CSV rows: ${csvRows.length}`);

  // 1. Verify COUNTRY-level data in JSON matches CSV exactly
  console.log('\n--- Country-level data verification ---');
  for (const row of csvRows) {
    if (!allCountries.includes(row.region)) continue;
    if (row.segment === 'By Region' || row.segment === 'By Country') continue;

    const geo = row.region;
    const seg = row.segment;
    const sub = row.subsegment;
    const sub1 = row.subsegment1;

    for (const year of years) {
      totalChecks++;
      const csvVal = row.years[year];

      // Check if path exists in JSON
      if (!json[geo]) {
        missing++;
        if (missing <= 5) countryMatchErrors.push(`MISSING geography: ${geo}`);
        continue;
      }
      if (!json[geo][seg]) {
        missing++;
        if (missing <= 5) countryMatchErrors.push(`MISSING segment: ${geo} > ${seg}`);
        continue;
      }
      if (!json[geo][seg][sub]) {
        missing++;
        if (missing <= 5) countryMatchErrors.push(`MISSING sub-segment: ${geo} > ${seg} > ${sub}`);
        continue;
      }
      if (!json[geo][seg][sub][sub1]) {
        missing++;
        if (missing <= 5) countryMatchErrors.push(`MISSING sub-segment1: ${geo} > ${seg} > ${sub} > ${sub1}`);
        continue;
      }

      const jsonVal = json[geo][seg][sub][sub1][year];
      if (Math.abs(csvVal - jsonVal) > 0.01) {
        mismatches++;
        if (mismatches <= 10) {
          countryMatchErrors.push(`MISMATCH: ${geo} > ${seg} > ${sub} > ${sub1} > ${year}: CSV=${csvVal} JSON=${jsonVal}`);
        }
      }
    }
  }

  console.log(`Total checks: ${totalChecks}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Missing: ${missing}`);
  if (countryMatchErrors.length > 0) {
    console.log('Sample errors:');
    countryMatchErrors.forEach(e => console.log('  ' + e));
  }

  // 2. Verify REGION sums (sum of countries should match CSV region values)
  console.log('\n--- Region sum verification (countries should sum to region total) ---');
  let regionChecks = 0;
  let regionMismatches = 0;

  for (const row of csvRows) {
    if (!regions.includes(row.region)) continue;
    if (row.segment === 'By Region' || row.segment === 'By Country') continue;

    const region = row.region;
    const seg = row.segment;
    const sub = row.subsegment;
    const sub1 = row.subsegment1;
    const countries = regionCountries[region];

    for (const year of years) {
      regionChecks++;
      const csvRegionVal = row.years[year];

      // Sum country values from JSON
      let countrySum = 0;
      let allFound = true;
      for (const country of countries) {
        if (json[country] && json[country][seg] && json[country][seg][sub] && json[country][seg][sub][sub1]) {
          countrySum += json[country][seg][sub][sub1][year];
        } else {
          allFound = false;
        }
      }

      countrySum = Math.round(countrySum * 100) / 100;

      if (Math.abs(csvRegionVal - countrySum) > 0.05) {
        regionMismatches++;
        if (regionMismatches <= 10) {
          regionSumErrors.push(`${region} > ${seg} > ${sub} > ${sub1} > ${year}: CSV region=${csvRegionVal} country sum=${countrySum} diff=${(csvRegionVal - countrySum).toFixed(2)}`);
        }
      }
    }
  }

  console.log(`Region checks: ${regionChecks}`);
  console.log(`Region sum mismatches (>0.05): ${regionMismatches}`);
  if (regionSumErrors.length > 0) {
    console.log('Sample region sum errors:');
    regionSumErrors.forEach(e => console.log('  ' + e));
  }

  // 3. Verify GLOBAL sums (sum of all countries should match CSV global values)
  console.log('\n--- Global sum verification (all countries should sum to global total) ---');
  let globalChecks = 0;
  let globalMismatches = 0;

  for (const row of csvRows) {
    if (row.region !== 'Global') continue;
    if (row.segment === 'By Region' || row.segment === 'By Country') continue;

    const seg = row.segment;
    const sub = row.subsegment;
    const sub1 = row.subsegment1;

    for (const year of years) {
      globalChecks++;
      const csvGlobalVal = row.years[year];

      let allCountriesSum = 0;
      for (const country of allCountries) {
        if (json[country] && json[country][seg] && json[country][seg][sub] && json[country][seg][sub][sub1]) {
          allCountriesSum += json[country][seg][sub][sub1][year];
        }
      }

      allCountriesSum = Math.round(allCountriesSum * 100) / 100;

      if (Math.abs(csvGlobalVal - allCountriesSum) > 0.1) {
        globalMismatches++;
        if (globalMismatches <= 10) {
          globalSumErrors.push(`Global > ${seg} > ${sub} > ${sub1} > ${year}: CSV=${csvGlobalVal} sum=${allCountriesSum} diff=${(csvGlobalVal - allCountriesSum).toFixed(2)}`);
        }
      }
    }
  }

  console.log(`Global checks: ${globalChecks}`);
  console.log(`Global sum mismatches (>0.1): ${globalMismatches}`);
  if (globalSumErrors.length > 0) {
    console.log('Sample global sum errors:');
    globalSumErrors.forEach(e => console.log('  ' + e));
  }

  // 4. Verify By Region data in JSON
  if (dataType === 'value') {
    console.log('\n--- By Region/By Country data verification ---');
    let byRegionChecks = 0;
    let byRegionMismatches = 0;
    const byRegionErrors = [];

    for (const row of csvRows) {
      if (row.segment === 'By Region' && row.region === 'Global') {
        // Check Global > By Region > regionName > regionName
        const regionName = row.subsegment;
        for (const year of years) {
          byRegionChecks++;
          const csvVal = row.years[year];
          const jsonVal = json['Global']?.['By Region']?.[regionName]?.[row.subsegment1]?.[year];
          if (jsonVal === undefined) {
            byRegionMismatches++;
            if (byRegionErrors.length < 5) byRegionErrors.push(`MISSING: Global > By Region > ${regionName} > ${row.subsegment1} > ${year}`);
          } else if (Math.abs(csvVal - jsonVal) > 0.01) {
            byRegionMismatches++;
            if (byRegionErrors.length < 5) byRegionErrors.push(`MISMATCH: Global > By Region > ${regionName} > ${row.subsegment1} > ${year}: CSV=${csvVal} JSON=${jsonVal}`);
          }
        }
      }
      if (row.segment === 'By Country') {
        // Check Global > By Region > parentRegion > countryName
        const parentRegion = row.region;
        const countryName = row.subsegment1;
        for (const year of years) {
          byRegionChecks++;
          const csvVal = row.years[year];
          const jsonVal = json['Global']?.['By Region']?.[parentRegion]?.[countryName]?.[year];
          if (jsonVal === undefined) {
            byRegionMismatches++;
            if (byRegionErrors.length < 5) byRegionErrors.push(`MISSING: Global > By Region > ${parentRegion} > ${countryName} > ${year}`);
          } else if (Math.abs(csvVal - jsonVal) > 0.01) {
            byRegionMismatches++;
            if (byRegionErrors.length < 5) byRegionErrors.push(`MISMATCH: Global > By Region > ${parentRegion} > ${countryName} > ${year}: CSV=${csvVal} JSON=${jsonVal}`);
          }
        }
      }
    }

    console.log(`By Region checks: ${byRegionChecks}`);
    console.log(`By Region mismatches: ${byRegionMismatches}`);
    if (byRegionErrors.length > 0) {
      console.log('Sample errors:');
      byRegionErrors.forEach(e => console.log('  ' + e));
    }
  }

  return { totalChecks, mismatches, missing, regionChecks, regionMismatches, globalChecks, globalMismatches };
}

// Run verification
const valResult = verifyCSVvsJSON('Nut value.csv', 'public/data/value.json', 'value');
const volResult = verifyCSVvsJSON('Nut volume.csv', 'public/data/volume.json', 'volume');

console.log('\n\n========== FINAL SUMMARY ==========');
console.log('VALUE:');
console.log(`  Country data: ${valResult.totalChecks} checks, ${valResult.mismatches} mismatches, ${valResult.missing} missing`);
console.log(`  Region sums: ${valResult.regionChecks} checks, ${valResult.regionMismatches} off by >0.05`);
console.log(`  Global sums: ${valResult.globalChecks} checks, ${valResult.globalMismatches} off by >0.1`);
console.log('VOLUME:');
console.log(`  Country data: ${volResult.totalChecks} checks, ${volResult.mismatches} mismatches, ${volResult.missing} missing`);
console.log(`  Region sums: ${volResult.regionChecks} checks, ${volResult.regionMismatches} off by >0.05`);
console.log(`  Global sums: ${volResult.globalChecks} checks, ${volResult.globalMismatches} off by >0.1`);
