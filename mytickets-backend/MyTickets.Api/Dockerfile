# The MyTickets API. Build from the mytickets-backend folder:
#   docker build -f MyTickets.Api/Dockerfile -t mytickets-api .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY MyTickets.Api/MyTickets.Api.csproj MyTickets.Api/
RUN dotnet restore MyTickets.Api/MyTickets.Api.csproj
COPY MyTickets.Api/ MyTickets.Api/
RUN dotnet publish MyTickets.Api/MyTickets.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
# The databases, uploaded files and sign-in keys live in /data (a volume). The image runs as the unprivileged
# "app" user, so the folder is made theirs before the volume is first mounted on it.
RUN mkdir -p /data && chown app:app /data
USER app
ENV ASPNETCORE_HTTP_PORTS=8001 \
    Data__Folder=/data
EXPOSE 8001
ENTRYPOINT ["dotnet", "MyTickets.Api.dll"]
