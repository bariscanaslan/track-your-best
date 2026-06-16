FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY TYB.ApiService.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish TYB.ApiService.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN mkdir -p wwwroot/uploads

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "TYB.ApiService.dll"]
