from flask import Flask, render_template, request, jsonify
import pandas as pd
import json
from scrapping.zillow import getData_pg1, parse, nextPage, enterNext, getData

app = Flask(__name__)

baseUrl = "https://www.zillow.com/{}/"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_listings', methods=['POST'])
def get_listings():
    try:
        zipCode = request.json.get('zipCode')
        if not zipCode:
            return jsonify({"error": "Zip code not provided"}), 400

        url = baseUrl.format(zipCode)
        print(f"Fetching data for zip code: {zipCode}")
        print(f"URL: {url}")

        # Collect all listings in a single array
        all_listings = []

        # Get first page
        response = getData_pg1(url, zipCode)
        if not response:
            return jsonify({"error": "Failed to fetch data from Zillow"}), 500
            
        json_data, listings = parse(response)
        if not listings:
            return jsonify({"error": "No listings found for this zip code"}), 404

        print(f"Found {len(listings)} listings on first page")
        all_listings.extend(listings)

        # Get additional pages
        total_pages = nextPage(json_data)
        print(f"Total pages: {total_pages}")

        if total_pages and total_pages > 1:
            url_list = enterNext(total_pages, url)
            
            for i, next_url in enumerate(url_list):
                print(f"Fetching page {i+2}: {next_url}")
                response = getData(next_url)
                if response:
                    json_data, listings = parse(response)
                    if listings:
                        print(f"Found {len(listings)} listings on page {i+2}")
                        all_listings.extend(listings)
                    else:
                        print(f"No listings found on page {i+2}")
                else:
                    print(f"Failed to fetch page {i+2}")

        print(f"Total listings collected: {len(all_listings)}")
        
        # Return all listings as JSON
        return jsonify({
            "success": True,
            "zipCode": zipCode,
            "totalListings": len(all_listings),
            "listings": all_listings
        }), 200
    
    except Exception as e:
        print(f"Error in get_listings: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)