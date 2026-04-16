import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  try {
    const data = event.body ? JSON.parse(event.body) : null;

if (!data) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'No form data received' })
  };
}

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

        const { error: dbError } = await supabase
      .from('website_leads')
      .insert([
        {
          name: data.Name || '',
          phone: data.Phone || '',
          address: data.Address || '',
          timeline: data.Timeline || '',
          notes: data.Notes || '',
          services: data["Selected Services"] || '',
          estimate: data["Estimated Price"] || '',
          created_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),

          window_cleaning_type: data["Window Cleaning Type"] || '',
          window_condition: data["Window Condition"] || '',
          standard_windows: data["Standard Windows"] || '',
          large_windows: data["Large Windows"] || '',
          french_pane_windows: data["French Pane Windows"] || '',
          interior_and_exterior: data["Interior and Exterior"] || '',
          ladder_work_windows_count: data["Ladder Work Windows Count"] || '',
          frames_tracks_sills: data["Frames Tracks Sills"] || '',
          screens_selected: data["Screens"] || '',
          hard_water: data["Hard Water"] || '',
          scrape_scrub: data["Scrape Scrub"] || '',

          house_square_footage: data["House Square Footage"] || '',
          house_stories: data["House Stories"] || '',
          house_surface_type: data["House Surface Type"] || '',
          house_condition: data["House Condition"] || '',

          surface_knows_square_footage: data["Surface Knows Square Footage"] || '',
          surface_square_footage: data["Surface Square Footage"] || '',
          surface_type: data["Surface Type"] || '',
          surface_condition: data["Surface Condition"] || '',
          surface_stain_fee: data["Surface Stain Fee"] || '',
          surface_access_fee: data["Surface Access Fee"] || '',

          roof_square_footage: data["Roof Square Footage"] || '',
          roof_type: data["Roof Type"] || '',
          roof_condition: data["Roof Condition"] || '',
          roof_pitch: data["Roof Pitch"] || '',

          other_service_description: data["Other Service Description"] || '',
          base_estimate: data["Base Estimate Before Discount"] || '',
          in_person_services: data["Services Requiring In Person Quote"] || ''
        }
      ]);

    if (dbError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: dbError.message })
      };
    }

    const emailPayload = {
      _subject: 'New Janela Enterprise Estimate Request',
      _captcha: 'false',
      _template: 'table',

      Name: data.Name || '',
      Phone: data.Phone || '',
      Address: data.Address || '',
      Timeline: data.Timeline || '',
      Notes: data.Notes || '',

      'Selected Services': data["Selected Services"] || '',
      'Estimated Price': data["Estimated Price"] || '',
      'Base Estimate Before Discount': data["Base Estimate Before Discount"] || '',
      'Discount Code': data["Discount Code"] || '',
      'Services Requiring In Person Quote': data["Services Requiring In Person Quote"] || '',

      'Window Cleaning Type': data["Window Cleaning Type"] || '',
      'Window Condition': data["Window Condition"] || '',
      'Standard Windows': data["Standard Windows"] || '',
      'Large Windows': data["Large Windows"] || '',
      'French Pane Windows': data["French Pane Windows"] || '',
      'Interior and Exterior': data["Interior and Exterior"] || '',
      'Ladder Work Windows Count': data["Ladder Work Windows Count"] || '',
      'Frames Tracks Sills': data["Frames Tracks Sills"] || '',
      'Screens': data["Screens"] || '',
      'Hard Water': data["Hard Water"] || '',
      'Scrape Scrub': data["Scrape Scrub"] || '',

      'House Square Footage': data["House Square Footage"] || '',
      'House Stories': data["House Stories"] || '',
      'House Surface Type': data["House Surface Type"] || '',
      'House Condition': data["House Condition"] || '',

      'Surface Knows Square Footage': data["Surface Knows Square Footage"] || '',
      'Surface Square Footage': data["Surface Square Footage"] || '',
      'Surface Type': data["Surface Type"] || '',
      'Surface Condition': data["Surface Condition"] || '',
      'Surface Stain Fee': data["Surface Stain Fee"] || '',
      'Surface Access Fee': data["Surface Access Fee"] || '',

      'Roof Square Footage': data["Roof Square Footage"] || '',
      'Roof Type': data["Roof Type"] || '',
      'Roof Condition': data["Roof Condition"] || '',
      'Roof Pitch': data["Roof Pitch"] || '',

      'Other Service Description': data["Other Service Description"] || ''
    };

    const emailResponse = await fetch(
      'https://formsubmit.co/ajax/janelaenterpriseservices@gmail.com',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(emailPayload)
      }
    );

            if (!emailResponse.ok) {
      const emailText = await emailResponse.text();

      console.error('FormSubmit email failed:', emailText);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          warning: 'Lead saved to database, but email copy failed'
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}