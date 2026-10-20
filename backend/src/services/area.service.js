const supabase = require('../config/supabase');

async function getAllArea() {
    const {data, error} = await supabase
        .from('areas')
        .select('*');

    if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

async function getAreaCinemas(areaId) {
  const { data, error } = await supabase
    .from("cinemas")
    .select("*")
    .eq("areaid", areaId);

  if (error) {
    console.error("Supabase query failed:", error);
    throw error;
  }

  return data;
}

module.exports = {
    getAllArea,
    getAreaCinemas
}