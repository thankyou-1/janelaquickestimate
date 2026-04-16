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
          created_at: new Date().toISOString()
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
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Saved to database, but email failed'
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