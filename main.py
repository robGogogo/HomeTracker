from flask import Flask, render_template, request, jsonify
import pandas as pd
from scrapping.zillow import getData_pg1, parse, nextPage, enterNext, save_to_db, getData
app = Flask(__name__)

baseUrl = "https://www.zillow.com/{}/"

@app.route('/')
def index():
    return render_template('index.html')  # This will render the HTML file

@app.route('/get_listings', methods=['POST'])
def get_listings():
    zipCode = request.json.get('zipCode')  # Get zipCode from the frontend request
    if not zipCode:
        return jsonify({"error": "Zip code not provided"}), 400

    url = baseUrl.format(zipCode)

    response = getData_pg1(url, zipCode)
    if response:
        json_data, listings = parse(response)
        if listings:
            
            save_to_db(listings, zipCode)
        else:
            return jsonify({"error": "Cannot find listings"}), 404

        total_pages = nextPage(json_data)
        print(f"Total pages: {total_pages}")

        url_list = enterNext(total_pages, url)

        for i in range(0, len(url_list)):
            response = getData(url_list[i])
            if response:
                print(f"Get page {i}")
                print(url_list[i])
                json_data, listings = parse(response)
                if listings:
                    save_to_db(listings, zipCode)
                else:
                    return jsonify({"error": "Cannot find listings on next page"}), 404
             
        return jsonify({"message": f"Listings successfully fetched and saved for {zipCode}"}), 200
    
    else:
        return jsonify({"error": "Failed to fetch data"}), 500

if __name__ == '__main__':
    app.run(debug=True)
