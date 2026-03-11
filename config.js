window.DELAWARE_DASHBOARD_CONFIG = {
  useSampleData: false,
  sampleDataUrl: "./data/delaware-dashboard-sample.json",
  focusDistricts: [
    "Red Clay Consolidated School District",
    "Brandywine School District",
    "Christina School District",
  ],
  focusDistrictCodes: ["31", "32", "33"],
  charterDistrictCodeFloor: 9000,
  sources: {
    achievement: {
      label: "Student achievement",
      url: "https://data.delaware.gov/resource/ms6b-mt82.json",
      pageSize: 50000,
      query:
        "$where=schoolcode='0' AND rowstatus='REPORTED' AND (districtcode in('31','32','33') OR districtcode >= 9000)",
    },
    attendance: {
      label: "Student attendance",
      url: "https://data.delaware.gov/resource/crb4-kdc7.json",
      pageSize: 50000,
      query:
        "$where=schoolcode='0' AND rowstatus='REPORTED' AND (districtcode in('31','32','33') OR districtcode >= 9000)",
    },
    mobility: {
      label: "Educator mobility",
      url: "https://data.delaware.gov/resource/jdcc-w6wr.json",
      pageSize: 50000,
      query:
        "$where=schoolcode='0' AND retention_type='One Year Percentage' AND race='All Educators' AND gender='All Educators' AND grade='All Educators' AND specialdemo='All Educators' AND geography='All Educators' AND staff_type='Professional' AND staff_category='Classroom Teacher' AND job_classification='ALL' AND experience_group='ALL' AND (districtcode in('31','32','33') OR districtcode >= 9000)",
    },
  },
};
