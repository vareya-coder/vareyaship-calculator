import { NextRequest, NextResponse } from "next/server"
import { db } from '../../../lib/dbClient'
import { ParcelQueryTable, ParcelRate } from "@/lib/schema";
import { sql } from "@vercel/postgres";
import { and, eq, gt, gte, lt } from "drizzle-orm";
import { boolean } from "drizzle-orm/mysql-core";


export const GET = async (request: NextRequest) => {

  const fromCountry = request.nextUrl.searchParams.get("originCountry");
  const toCountry = request.nextUrl.searchParams.get("destinationCountry");
  const weight = parseFloat(request.nextUrl.searchParams.get("weight") || "0");
  const length = parseFloat(request.nextUrl.searchParams.get("length") || '0');
  const width = parseFloat(request.nextUrl.searchParams.get("width") || "0");
  const height = parseFloat(request.nextUrl.searchParams.get("height") || "0");

  let messages: string[] = [];
  let queryResults: string[] = [];

  interface Carriers {
    company: string,
    fromCountry: string,
    maxWeight: number,
    maxLength?: any,
    width?: any,
    height?: any
  }

  let carriers: Carriers[] = [{
    company: "PostNL",
    fromCountry: "Netherlands",
    maxWeight: 2,
    maxLength: 600,
    width: 600,
    height: 600
  },
  // {
  //   company: "DHL Express",
  //   fromCountry: "Germany",
  //   maxWeight: 30,
  //   maxLength: 600,
  //   width: 600,
  //   height: 600
  // },
  // {
  //   company: "DHL Parcel",
  //   fromCountry: "Germany",
  //   maxWeight: 30,
  //   maxLength: 600,
  //   width: 0,
  //   height: 0
  // },
  // {
  //   company: "Royal Mail",
  //   fromCountry: "United Kingdom",
  //   maxWeight: 2,
  //   maxLength: 600,
  //   width: 0,
  //   height: 0
  // },
  {
    company: "Asendia",
    fromCountry: "France",
    maxWeight: 2,
    maxLength: 600,
    width: 600,
    height: 600
  }
  ];

  let isPackageDimensionValid = (packageLength: number, packageWidth: number, packageHeight: number): boolean => {
    const isTotalDimensionValid = (packageLength + packageWidth + packageHeight) <= 90;
    let sideUpto600mm = 0;
    if (packageLength <= 60) sideUpto600mm++;
    if (packageWidth <= 60) sideUpto600mm++;
    if (packageHeight <= 60) sideUpto600mm++;

    return sideUpto600mm > 2 && isTotalDimensionValid;
  }

  const validDimensions = isPackageDimensionValid(length, width, height)

  if (!fromCountry || !toCountry || isNaN(weight) || weight <= 0 || length <= 0 || width <= 0 || height < 0) {
    queryResults.push("Origin Country, Destination Country, and Weight fields are mandatory to fill")
  } else {

    for (let carrier of carriers) {

      if (fromCountry === carrier.fromCountry && weight <= carrier.maxWeight) {
        if (!validDimensions) {

          const dimensionMessage = `Package dimensions are not valid for ${carrier.company}.`;

          queryResults.push(dimensionMessage);
          continue; // Skip to the next carrier
        }
        try {
          const result = await db.select({
            fromCountry: ParcelQueryTable.fromCountry,
            toCountry: ParcelQueryTable.toCountry,
            carrier: ParcelQueryTable.carrier,
            ratePerItem: ParcelQueryTable.ratePerItem,
            ratePerKg: ParcelQueryTable.ratePerKg
          }).from(ParcelQueryTable)
            .where(
              and(
                eq(ParcelQueryTable.fromCountry, fromCountry),
                eq(ParcelQueryTable.toCountry, toCountry),
                eq(ParcelQueryTable.carrier, carrier.company),
                lt(ParcelQueryTable.weightFrom, weight),
                gte(ParcelQueryTable.weightTo, weight),
                // gt(ParcelQueryTable.maxSumDim, length + width + height),
                // gt(ParcelQueryTable.maxOneDim, length),
                // gt(ParcelQueryTable.maxOneDim, width),
                // gt(ParcelQueryTable.maxOneDim, height)
              )
            );

          if (result.length > 0) {
            result.forEach((row: Partial<ParcelRate>) => {
              const ratePerItem = row.ratePerItem ? row.ratePerItem : 0;
              const ratePerKg = row.ratePerKg ? row.ratePerKg : 0;
              const calculatedRate = ratePerItem + (ratePerKg * weight)
              queryResults.push(`€${calculatedRate}`)
            });
          };
        } catch (error) {
          console.error("Query Error: ", error);
          messages.push(`Error querying rates for ${carrier.company}.`)
        }

      } else if (fromCountry === carrier.fromCountry) {
        queryResults.push(`Service by ${carrier.company} in ${fromCountry} is limited to packages under ${carrier.maxWeight}kg.`) // only to check client response
        messages.push(`Service by ${carrier.company} in ${fromCountry} is limited to packages under ${carrier.maxWeight}kg`);
      } else {
        messages.push(`Service is not provided by ${carrier.company} in ${fromCountry}`);
        queryResults.push(`Service is not provided by ${carrier.company} in ${fromCountry}.`); // only to check client response
      }
    }
  }

  return new NextResponse(JSON.stringify({ results: queryResults, messages: messages }), {
    status: queryResults.length > 0 ? 200 : 400
  });

}