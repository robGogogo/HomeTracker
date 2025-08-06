from bs4 import BeautifulSoup
import pandas as pd
import requests
import json
import os
from pathlib import Path

# This is only used for page 1
def getData_pg1(url, zipCode):

    result = requests.get(url)
    # content = result.text
    headers = {
        "authority": "www.zillow.com",
        "method": "GET",
        "scheme": "https",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=0, i",
        "referer": "https://www.zillow.com/{}/".format(zipCode),
        "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 403:
        print("Request blocked (403 Forbidden)")
        return None  # Return None if blocked

    print(response)  # Print status for debugging
    return response  # Return response object

# This is used for the pages after page
def getData(url):
    result = requests.get(url)
    # content = result.text
    headers = {
        "authority": "www.zillow.com",
        "method": "GET",
        "scheme": "https",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=0, i",
        "referer": url,
        "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 403:
        print("Request blocked (403 Forbidden)")
        return None  # Return None if blocked

    print(response)  # Print status for debugging
    return response  # Return response object

# This is used to parse the data from response
def parse(response):
    soup = BeautifulSoup(response.text, "html.parser")

    # Find the script tag with id "__NEXT_DATA__"
    tag = soup.find('script', {'id': "__NEXT_DATA__"})

    # Extract the text content using tag
    if tag:
        content = tag.string
        # print(content)
        json_data =  json.loads(content)
    else:
        print("Cannot find the script tag with id __NEXT_DATA__")
        return None, []
    
    try:
        listings = json_data['props']['pageProps']['searchPageState']['cat1']['searchResults']['listResults']
        print(f"Found {len(listings)} listings on the page")
        # print(listings)
    except KeyError as e: 
        print(f"Error encountered when parsing listings: {e}")
        return None, []

    return json_data, listings

# This is used to go to the next page of the listing
def nextPage(json_data):
    try:
        total_pages = json_data['props']['pageProps']['searchPageState']['cat1']['searchList']['totalPages']
        return total_pages
    except KeyError as e:
        print(f"KeyError: {e} not found in JSON data")
        return None

#This is used to enter the pages remain
def enterNext(total_pages, url):
    url_list = []
    for page in range(2, total_pages + 1): 
        url_og = url
        url_modified = url_og + "{}_p/".format(page)
        url_list.append(url_modified)
        url_modified = url
    return url_list

# This is used to save listings in database
def save_to_db(listings, zipCode):
    filename="./static/{}.csv".format(zipCode)
    df = pd.DataFrame(listings)
    # Save to CSV (append mode if file exists)
    df.to_csv(filename, mode='a', index=False, header=not pd.io.common.file_exists(filename))

    print(f"Saved {len(listings)} listings to {filename}!")  


# This is used to delete the corresponding csv file
def delete_db(zipCode):
    file_path = Path('./static/{}.csv'.format(zipCode))
    file_path.unlink()
    return
